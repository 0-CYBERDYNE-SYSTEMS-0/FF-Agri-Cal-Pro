import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import * as bcrypt from "bcrypt";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertProjectSchema, insertEventSchema, insertConversationSchema, insertUserFileSchema, insertUserDocumentSchema, WeatherForecast, Event, InsertEvent } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { searchWeb } from "./perplexityApi";
import { fetchComprehensiveWeather, getAgricultureRecommendations, geocodeLocation, formatWeatherData, WeatherResponse } from "./openWeatherApi";
import { expandRecurringEvents, RecurringPattern } from "@shared/recurrence";
import { parseICS, planImport, serializeICS } from "@shared/ics";
import { CHAT_MODEL, TOOL_LOOP_LIMIT, createChatClient } from "./modelConfig";
import {
  createEventToolSchema,
  updateEventToolSchema,
  deleteEventToolSchema,
  searchEventsToolSchema,
  getOrCreateProjectToolSchema,
  readUserFileToolSchema,
  listUserFilesToolSchema,
  createUserDocumentToolSchema,
  listUserDocumentsToolSchema,
  updateEventRouteSchema,
  updateProjectRouteSchema,
  updateUserFileRouteSchema,
  updateUserDocumentRouteSchema,
  upsertFarmRouteSchema,
  createFieldRouteSchema,
  updateFieldRouteSchema,
  createCropRouteSchema,
  updateCropRouteSchema,
  createEquipmentRouteSchema,
  updateEquipmentRouteSchema,
  createBuildingRouteSchema,
  updateBuildingRouteSchema,
  createStaffRouteSchema,
  updateStaffRouteSchema,
} from "./toolSchemas";
import { buildFarmContextLines } from "./farmContext";

// Helper function to determine the current season based on date and hemisphere
function getSeasonForDate(date: Date, northernHemisphere: boolean): string {
  const month = date.getMonth();
  const day = date.getDate();

  if (northernHemisphere) {
    if ((month === 11 && day >= 21) || month < 2 || (month === 2 && day <= 20)) {
      return "Winter";
    } else if ((month === 2 && day >= 21) || month < 5 || (month === 5 && day <= 20)) {
      return "Spring";
    } else if ((month === 5 && day >= 21) || month < 8 || (month === 8 && day <= 22)) {
      return "Summer";
    } else {
      return "Fall";
    }
  } else {
    // Southern hemisphere (seasons reversed)
    if ((month === 11 && day >= 21) || month < 2 || (month === 2 && day <= 20)) {
      return "Summer";
    } else if ((month === 2 && day >= 21) || month < 5 || (month === 5 && day <= 20)) {
      return "Fall";
    } else if ((month === 5 && day >= 21) || month < 8 || (month === 8 && day <= 22)) {
      return "Winter";
    } else {
      return "Spring";
    }
  }
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function formatFarmDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

interface MutationResult {
  type: string;
  id: number;
  ok: boolean;
}

function describeMutations(mutations: MutationResult[]): string {
  return mutations.map(m => `${m.type} #${m.id}${m.ok ? "" : " (failed)"}`).join(", ");
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API error handler middleware
  const handleApiError = (err: any, res: Response) => {
    console.error("API Error:", err);

    if (err instanceof ZodError) {
      const validationError = fromZodError(err);
      return res.status(400).json({ message: validationError.message });
    }

    return res.status(500).json({ message: err.message || "Internal Server Error" });
  };

  // Auth middleware: every private route requires a session user
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    next();
  };

  // Session user id; only valid after requireAuth (no fallback user)
  const getUserId = (req: Request): number => (req.session as any).userId as number;

  // Loads an owned record or responds 404 (existence is not leaked across users)
  const ownedOr404 = async <T extends { userId: number }>(
    req: Request, res: Response, load: () => Promise<T | undefined>
  ): Promise<T | null> => {
    const record = await load();
    if (!record || record.userId !== getUserId(req)) {
      res.status(404).json({ message: "Not found" });
      return null;
    }
    return record;
  };

  // Validates a projectId argument against the user's own projects
  const ownedProjectOrError = async (userId: number, projectId: number): Promise<string | null> => {
    const project = await storage.getProject(projectId);
    if (!project || project.userId !== userId) {
      return `Project ${projectId} was not found`;
    }
    return null;
  };

  // Validates a fieldId argument against the user's own fields
  const ownedFieldOrError = async (userId: number, fieldId: number): Promise<string | null> => {
    const field = await storage.getField(fieldId);
    if (!field || field.userId !== userId) {
      return `Field ${fieldId} was not found`;
    }
    return null;
  };

  // User routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);

      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      // Hash the password before storing
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);

      const user = await storage.createUser({ ...userData, password: hashedPassword });
      // Don't return password in response
      const { password, ...userResponse } = user;

      return res.status(201).json(userResponse);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = z.object({
        username: z.string(),
        password: z.string()
      }).parse(req.body);

      const user = await storage.getUserByUsername(username);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session
      (req.session as any).userId = user.id;

      // Don't return password in response
      const { password: _, ...userResponse } = user;

      return res.status(200).json(userResponse);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      return res.status(200).json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/status", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any).userId;
      if (!userId) {
        return res.status(200).json({ authenticated: false, user: null });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(200).json({ authenticated: false, user: null });
      }
      const { password, ...userResponse } = user;
      return res.status(200).json({ authenticated: true, user: userResponse });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/users/me", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(getUserId(req));

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Don't return password in response
      const { password, ...userResponse } = user;

      return res.status(200).json(userResponse);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Project routes
  app.get("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const projects = await storage.getProjectsByUser(userId);
      return res.status(200).json(projects);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await ownedOr404(req, res, () => storage.getProject(id));
      if (!project) return;

      return res.status(200).json(project);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/projects", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const projectData = insertProjectSchema.parse({ ...req.body, userId });
      const project = await storage.createProject(projectData);
      return res.status(201).json(project);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await ownedOr404(req, res, () => storage.getProject(id));
      if (!project) return;

      // Strict schema: rejects attempts to change userId/id through the body
      const updates = updateProjectRouteSchema.parse(req.body);
      const updatedProject = await storage.updateProject(id, updates);

      if (!updatedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json(updatedProject);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/projects/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await ownedOr404(req, res, () => storage.getProject(id));
      if (!project) return;

      await storage.deleteProject(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Event routes — literal paths are registered BEFORE "/api/events/:id"
  // so /api/events/ics and /api/events/weather-dependent reach their handlers.

  // Get calendar events as ICS file
  app.get("/api/events/ics", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const userEvents = await storage.getEventsByUser(userId);

      const icsContent = serializeICS(userEvents.map(event => ({
        id: event.id,
        uid: event.uid,
        title: event.title,
        description: event.description,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        allDay: event.allDay,
        checkWeather: event.checkWeather,
        projectId: event.projectId,
        isRecurring: event.isRecurring,
        recurringPattern: (event.recurringPattern ?? null) as RecurringPattern | null,
      })));

      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=farm-calendar.ics');

      return res.status(200).send(icsContent);
    } catch (err) {
      console.error("Error generating ICS file:", err);
      return handleApiError(err, res);
    }
  });

  app.get("/api/events/weather-dependent", requireAuth, async (req: Request, res: Response) => {
    try {
      const location = req.query.location as string;
      if (!location) {
        return res.status(400).json({ message: "Location is required" });
      }

      const weatherData = await fetchComprehensiveWeather(location);
      if (!weatherData) {
        return res.status(404).json({
          message: "Could not find weather data for this location. Please try a more specific location (e.g., 'Eugene, Oregon' instead of 'Lane County')."
        });
      }

      const userId = getUserId(req);
      const events = await storage.getEventsByUser(userId);
      const weatherDependentEvents = events.filter(event => event.checkWeather);

      const formattedData = formatWeatherData(weatherData);
      return res.status(200).json({
        weather: formattedData,
        events: weatherDependentEvents
      });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // ICS Import — validate the full file, then write the batch in a transaction.
  // Duplicate policy: events whose UID already exists for the user are skipped
  // and reported (never silently duplicated, never overwritten).
  app.post("/api/events/import-ics", requireAuth, async (req: Request, res: Response) => {
    try {
      const { icsContent } = z.object({
        icsContent: z.string().min(1, "ICS content is required"),
      }).parse(req.body);

      const userId = getUserId(req);
      const { events: parsed, errors } = parseICS(icsContent);

      if (errors.length > 0) {
        return res.status(400).json({
          message: `Import rejected: ${errors.length} event(s) could not be parsed. No events were written.`,
          errors,
        });
      }

      if (parsed.length === 0) {
        return res.status(400).json({ message: "No valid events found in ICS content" });
      }

      const existing = await storage.getEventsByUser(userId);
      const existingUids = existing
        .map(event => event.uid)
        .filter((uid): uid is string => !!uid);
      const { toCreate, duplicates } = planImport(parsed, existingUids);

      const eventsToInsert: InsertEvent[] = toCreate.map(eventData => ({
        userId,
        title: eventData.title,
        description: eventData.description,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        location: eventData.location,
        projectId: null,
        allDay: eventData.allDay,
        checkWeather: eventData.checkWeather,
        isRecurring: !!eventData.recurringPattern,
        recurringPattern: eventData.recurringPattern,
        uid: eventData.uid,
      }));

      const created = await storage.createEvents(eventsToInsert);

      return res.status(201).json({
        message: `Imported ${created.length} event(s), skipped ${duplicates.length} duplicate(s)`,
        count: created.length,
        skipped: duplicates.length,
        events: created,
      });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/events", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // If startDate and endDate are provided, filter events by date range
      if (req.query.startDate && req.query.endDate) {
        const startDate = new Date(req.query.startDate as string);
        const endDate = new Date(req.query.endDate as string);

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          return res.status(400).json({ message: "Invalid date format" });
        }

        const events = await storage.getEventsByDateRange(userId, startDate, endDate);
        return res.status(200).json(events);
      }

      // If projectId is provided, filter events by project (owned projects only)
      if (req.query.projectId) {
        const projectId = parseInt(req.query.projectId as string);
        const events = await storage.getEventsByProject(projectId);
        return res.status(200).json(events.filter(event => event.userId === userId));
      }

      // Otherwise, get all events for the user
      const events = await storage.getEventsByUser(userId);
      return res.status(200).json(events);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/events/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await ownedOr404(req, res, () => storage.getEvent(id));
      if (!event) return;

      return res.status(200).json(event);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/events", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Handle both string and Date objects for dates
      const { startDate, endDate, ...restBody } = req.body;

      // Convert dates if they're strings; userId comes from the session last so
      // a client body cannot assign the event to another user
      const parsedData = {
        ...restBody,
        startDate: typeof startDate === 'string' ? new Date(startDate) : startDate,
        endDate: typeof endDate === 'string' ? new Date(endDate) : endDate,
        userId,
      };

      // Now parse with the schema
      const eventData = insertEventSchema.parse(parsedData);
      const event = await storage.createEvent(eventData);
      return res.status(201).json(event);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/events/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await ownedOr404(req, res, () => storage.getEvent(id));
      if (!event) return;

      // Strict partial schema: only supported fields, no ownership or ID changes
      const updates = updateEventRouteSchema.parse(req.body);

      if (updates.projectId !== undefined && updates.projectId !== null) {
        const projectError = await ownedProjectOrError(getUserId(req), updates.projectId);
        if (projectError) {
          return res.status(400).json({ message: projectError });
        }
      }

      const updatedEvent = await storage.updateEvent(id, updates);

      if (!updatedEvent) {
        return res.status(404).json({ message: "Event not found" });
      }

      return res.status(200).json(updatedEvent);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/events/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await ownedOr404(req, res, () => storage.getEvent(id));
      if (!event) return;

      await storage.deleteEvent(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Weather routes
  const weatherQuerySchema = z.object({
    location: z.string().trim().min(1).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  });

  app.get("/api/weather", async (req: Request, res: Response) => {
    try {
      const query = weatherQuerySchema.parse(req.query);
      const hasCoords = query.lat !== undefined && query.lon !== undefined;
      const hasLocation = !!query.location;

      if (hasCoords === hasLocation) {
        return res.status(400).json({ message: "Provide either a location name or lat and lon coordinates" });
      }

      const weatherData = hasCoords
        ? await fetchComprehensiveWeather({ lat: query.lat!, lon: query.lon! })
        : await fetchComprehensiveWeather(query.location!);

      if (!weatherData) {
        return res.status(404).json({
          message: "Could not find weather data for this location. Please try a more specific location (e.g., 'Eugene, Oregon' instead of 'Lane County')."
        });
      }

      const formattedData = formatWeatherData(weatherData);
      // Persist one snapshot per location per day (best-effort): weather
      // history feeds the proactive agent and later analysis. A cache-write
      // failure must never break the weather response.
      storage.upsertWeatherCache(formattedData.location, new Date(), formattedData).catch(err => {
        console.warn("Weather cache write failed:", err instanceof Error ? err.message : err);
      });
      return res.status(200).json(formattedData);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Web search route — research failures surface as errors, never as results
  app.post("/api/search", requireAuth, async (req: Request, res: Response) => {
    let query: string;
    try {
      query = z.object({ query: z.string().min(1) }).parse(req.body).query;
    } catch (err) {
      return handleApiError(err, res);
    }
    try {
      const searchResults = await searchWeb(query);
      return res.status(200).json({ results: searchResults });
    } catch (err: any) {
      return res.status(502).json({ message: err.message || "Web search failed" });
    }
  });

  // Assistant/Conversation routes
  app.get("/api/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const conversations = await storage.getConversationsByUser(userId);
      return res.status(200).json(conversations);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/conversations/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await ownedOr404(req, res, () => storage.getConversation(id));
      if (!conversation) return;

      return res.status(200).json(conversation);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/conversations", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      let messages = req.body.messages || [];

      if (messages.length === 0) {
        messages.push({
          role: "assistant",
          content: "Hello! I'm your Farm Friend agricultural assistant. How can I help with your agricultural planning today?"
        });
      }

      const conversationData = insertConversationSchema.parse({ messages, userId });
      const conversation = await storage.createConversation(conversationData);
      return res.status(201).json(conversation);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  const chatMessageSchema = z.object({
    message: z.string().min(1),
    adviceMode: z.enum(["general", "local"]),
    location: z.string().trim().min(1).max(200).nullable().optional(),
    timeZone: z.string().trim().min(1),
  });

  // Executes a single tool call, preserving its call ID for the tool result
  // message. Every write validates ownership and returns the saved ID or an
  // explicit not-found/failure result — a failed write never reports success.
  const executeToolCall = async (
    toolCall: { id: string; function: { name: string; arguments: string } },
    userId: number
  ): Promise<{ content: string; mutation?: MutationResult }> => {
    let rawArgs: any = {};
    try {
      rawArgs = JSON.parse(toolCall.function.arguments || "{}");
    } catch {
      return { content: JSON.stringify({ success: false, error: "Tool arguments were not valid JSON" }) };
    }

    const failure = (error: string): { content: string; mutation?: MutationResult } => ({
      content: JSON.stringify({ success: false, error })
    });

    switch (toolCall.function.name) {
      case "search_web": {
        try {
          const result = await searchWeb(String(rawArgs.query ?? ""));
          return { content: JSON.stringify({ success: true, content: result.content, citations: result.citations }) };
        } catch (error: unknown) {
          return failure(error instanceof Error ? error.message : "Web research failed");
        }
      }

      case "get_weather": {
        const weatherData = await fetchComprehensiveWeather(String(rawArgs.location ?? ""));
        if (!weatherData) {
          return failure("Weather data was unavailable for that location");
        }
        const recommendations = getAgricultureRecommendations(weatherData);
        return { content: JSON.stringify({ success: true, weather: formatWeatherData(weatherData), recommendations }) };
      }

      case "create_calendar_event": {
        const args = createEventToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid event arguments: ${fromZodError(args.error).message}`);
        }
        if (args.data.endDate.getTime() <= args.data.startDate.getTime()) {
          return failure("The event end must be after the start");
        }
        if (args.data.projectId !== undefined) {
          const projectError = await ownedProjectOrError(userId, args.data.projectId);
          if (projectError) return failure(projectError);
        }
        const newEvent = await storage.createEvent({
          userId,
          title: args.data.title,
          description: args.data.description ?? null,
          startDate: args.data.startDate,
          endDate: args.data.endDate,
          location: args.data.location ?? null,
          projectId: args.data.projectId ?? null,
          allDay: args.data.allDay ?? false,
          checkWeather: args.data.checkWeather ?? true,
          isRecurring: !!args.data.recurringPattern,
          recurringPattern: args.data.recurringPattern
            ? {
                frequency: args.data.recurringPattern.frequency,
                interval: args.data.recurringPattern.interval,
                endDate: args.data.recurringPattern.endDate instanceof Date
                  ? args.data.recurringPattern.endDate.toISOString()
                  : null,
              }
            : null,
        });
        return {
          content: JSON.stringify({ success: true, eventId: newEvent.id, event: newEvent }),
          mutation: { type: "create_event", id: newEvent.id, ok: true },
        };
      }

      case "update_calendar_event": {
        const args = updateEventToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid update arguments: ${fromZodError(args.error).message}`);
        }
        const existing = await storage.getEvent(args.data.eventId);
        if (!existing || existing.userId !== userId) {
          return failure(`Event ${args.data.eventId} was not found`);
        }
        const { eventId, ...fields } = args.data;
        const updates: Partial<Event> = {};
        if (fields.title !== undefined) updates.title = fields.title;
        if (fields.description !== undefined) updates.description = fields.description ?? null;
        if (fields.startDate !== undefined) updates.startDate = fields.startDate;
        if (fields.endDate !== undefined) updates.endDate = fields.endDate;
        if (fields.allDay !== undefined) updates.allDay = fields.allDay;
        if (fields.location !== undefined) updates.location = fields.location ?? null;
        if (fields.checkWeather !== undefined) updates.checkWeather = fields.checkWeather;
        if (fields.isRecurring !== undefined) updates.isRecurring = fields.isRecurring;
        if (fields.recurringPattern !== undefined) {
          updates.recurringPattern = fields.recurringPattern
            ? { ...fields.recurringPattern, endDate: fields.recurringPattern.endDate?.toISOString() ?? null }
            : null;
        }
        if (fields.projectId !== undefined) {
          if (fields.projectId !== null) {
            const projectError = await ownedProjectOrError(userId, fields.projectId);
            if (projectError) return failure(projectError);
          }
          updates.projectId = fields.projectId ?? null;
        }
        const updated = await storage.updateEvent(eventId, updates);
        if (!updated) {
          return failure(`Event ${eventId} was not found`);
        }
        return {
          content: JSON.stringify({ success: true, eventId: updated.id, event: updated }),
          mutation: { type: "update_event", id: updated.id, ok: true },
        };
      }

      case "delete_calendar_event": {
        const args = deleteEventToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid delete arguments: ${fromZodError(args.error).message}`);
        }
        const existing = await storage.getEvent(args.data.eventId);
        if (!existing || existing.userId !== userId) {
          return failure(`Event ${args.data.eventId} was not found`);
        }
        const deleted = await storage.deleteEvent(args.data.eventId);
        if (!deleted) {
          return failure(`Event ${args.data.eventId} could not be deleted`);
        }
        return {
          content: JSON.stringify({ success: true, eventId: args.data.eventId }),
          mutation: { type: "delete_event", id: args.data.eventId, ok: true },
        };
      }

      case "search_calendar_events": {
        const args = searchEventsToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid search arguments: ${fromZodError(args.error).message}`);
        }
        let results: Event[];
        if (args.data.startDate && args.data.endDate) {
          results = await storage.getEventsByDateRange(userId, args.data.startDate, args.data.endDate);
        } else if (args.data.projectId !== undefined) {
          const projectError = await ownedProjectOrError(userId, args.data.projectId);
          if (projectError) return failure(projectError);
          results = (await storage.getEventsByProject(args.data.projectId)).filter(event => event.userId === userId);
        } else {
          results = await storage.getEventsByUser(userId);
        }
        if (args.data.keyword) {
          const keyword = args.data.keyword.toLowerCase();
          results = results.filter(event =>
            (event.title && event.title.toLowerCase().includes(keyword)) ||
            (event.description && event.description.toLowerCase().includes(keyword))
          );
        }
        return { content: JSON.stringify({ success: true, events: results }) };
      }

      case "get_or_create_project": {
        const args = getOrCreateProjectToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid project arguments: ${fromZodError(args.error).message}`);
        }
        const userProjects = await storage.getProjectsByUser(userId);
        const existing = userProjects.find(project => project.name.toLowerCase() === args.data.name.toLowerCase());
        if (existing) {
          return { content: JSON.stringify({ success: true, projectId: existing.id, project: existing, isNew: false }) };
        }
        const newProject = await storage.createProject({
          userId,
          name: args.data.name,
          description: args.data.description ?? "",
          status: "active",
          startDate: new Date(),
          endDate: null,
        });
        return {
          content: JSON.stringify({ success: true, projectId: newProject.id, project: newProject, isNew: true }),
          mutation: { type: "create_project", id: newProject.id, ok: true },
        };
      }

      case "read_user_file": {
        const args = readUserFileToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid file arguments: ${fromZodError(args.error).message}`);
        }
        let file;
        if (args.data.fileId !== undefined) {
          const found = await storage.getUserFile(args.data.fileId);
          file = found && found.userId === userId ? found : undefined;
        } else if (args.data.filename) {
          const userFiles = await storage.getUserFilesByUser(userId);
          file = userFiles.find(f => f.originalName === args.data!.filename || f.filename === args.data!.filename);
        }
        if (!file) {
          return failure("File not found");
        }

        // Only text formats are readable: the upload pipeline stores decoded
        // text in metadata.content. Binary formats (pdf, xlsx) are not
        // decodable there and must fail honestly rather than return garbage.
        const readableTypes = new Set(["csv", "txt", "text", "json", "ics", "md", "log", "xml", "yaml", "yml"]);
        if (!readableTypes.has(file.fileType.toLowerCase())) {
          return failure(
            `Files of type "${file.fileType}" are stored as binary and cannot be read as text. ` +
            `Export the file as CSV or plain text and upload that instead.`
          );
        }

        const metadata = (file.metadata && typeof file.metadata === "object" ? file.metadata : {}) as Record<string, unknown>;
        const content = typeof metadata.content === "string"
          ? metadata.content
          : typeof metadata.rawContent === "string"
            ? metadata.rawContent
            : null;
        if (content === null) {
          return failure(`No readable text content was stored for "${file.originalName}"`);
        }

        // Guard what goes back into the model context: 50k chars is already a
        // very large excerpt; the model can ask follow-ups on the same file.
        const MAX_FILE_EXCERPT = 50_000;
        const excerpt = content.length > MAX_FILE_EXCERPT
          ? content.slice(0, MAX_FILE_EXCERPT) + `\n…[truncated; ${content.length - MAX_FILE_EXCERPT} more characters]`
          : content;

        return {
          content: JSON.stringify({
            success: true,
            file: {
              id: file.id,
              filename: file.originalName,
              fileType: file.fileType,
              size: file.fileSize,
              uploadDate: file.uploadDate,
              description: file.description,
            },
            content: excerpt,
          })
        };
      }

      case "list_user_files": {
        const args = listUserFilesToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid list arguments: ${fromZodError(args.error).message}`);
        }
        let files;
        if (args.data.fileType) {
          files = await storage.getUserFilesByType(userId, args.data.fileType);
        } else if (args.data.projectId !== undefined) {
          const projectError = await ownedProjectOrError(userId, args.data.projectId);
          if (projectError) return failure(projectError);
          files = (await storage.getUserFilesByProject(args.data.projectId)).filter(file => file.userId === userId);
        } else {
          files = await storage.getUserFilesByUser(userId);
        }
        return {
          content: JSON.stringify({
            success: true,
            files: files.map(file => ({
              id: file.id,
              filename: file.originalName,
              fileType: file.fileType,
              size: file.fileSize,
              uploadDate: file.uploadDate,
              description: file.description,
              projectId: file.projectId
            }))
          })
        };
      }

      case "create_user_document": {
        const args = createUserDocumentToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid document arguments: ${fromZodError(args.error).message}`);
        }
        if (args.data.projectId !== undefined) {
          const projectError = await ownedProjectOrError(userId, args.data.projectId);
          if (projectError) return failure(projectError);
        }
        const newDocument = await storage.createUserDocument({
          userId,
          title: args.data.title,
          content: args.data.content,
          documentType: args.data.documentType ?? "note",
          projectId: args.data.projectId ?? null,
          tags: args.data.tags ?? null,
          isPublic: false,
        });
        return {
          content: JSON.stringify({
            success: true,
            document: {
              id: newDocument.id,
              title: newDocument.title,
              documentType: newDocument.documentType,
              createdAt: newDocument.createdAt,
              projectId: newDocument.projectId
            }
          }),
          mutation: { type: "create_document", id: newDocument.id, ok: true },
        };
      }

      case "list_user_documents": {
        const args = listUserDocumentsToolSchema.safeParse(rawArgs);
        if (!args.success) {
          return failure(`Invalid list arguments: ${fromZodError(args.error).message}`);
        }
        let documents;
        if (args.data.documentType) {
          documents = await storage.getUserDocumentsByType(userId, args.data.documentType);
        } else if (args.data.projectId !== undefined) {
          const projectError = await ownedProjectOrError(userId, args.data.projectId);
          if (projectError) return failure(projectError);
          documents = (await storage.getUserDocumentsByProject(args.data.projectId)).filter(doc => doc.userId === userId);
        } else {
          documents = await storage.getUserDocumentsByUser(userId);
        }
        return {
          content: JSON.stringify({
            success: true,
            documents: documents.map(doc => ({
              id: doc.id,
              title: doc.title,
              documentType: doc.documentType,
              createdAt: doc.createdAt,
              updatedAt: doc.updatedAt,
              projectId: doc.projectId,
              tags: doc.tags
            }))
          })
        };
      }

      default:
        return failure(`Unknown tool "${toolCall.function.name}"`);
    }
  };

  app.post("/api/conversations/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await ownedOr404(req, res, () => storage.getConversation(id));
      if (!conversation) return;

      const body = chatMessageSchema.parse(req.body);
      const { message, adviceMode } = body;
      const timeZone = isValidTimeZone(body.timeZone) ? body.timeZone : "UTC";
      const userId = getUserId(req);

      // Resolve the location for local advice. Never substitute a default city.
      let resolvedLocation: { name: string; lat: number; lon: number } | null = null;

      if (adviceMode === "local") {
        if (!body.location) {
          return res.status(400).json({
            message: "A valid location is required for local advice. Set a location or switch to general advice mode.",
            missingLocation: true
          });
        }

        const geocoded = await geocodeLocation(body.location);
        if (!geocoded) {
          return res.status(400).json({
            message: `Could not resolve "${body.location}" to a valid location. Please set a valid location or switch to general advice mode.`,
            missingLocation: true
          });
        }

        resolvedLocation = { name: geocoded.resolvedName, lat: geocoded.lat, lon: geocoded.lon };
      }

      // Build context once for this message
      const now = new Date();

      let weather: WeatherResponse | null = null;
      if (adviceMode === "local" && resolvedLocation) {
        const weatherData = await fetchComprehensiveWeather({ lat: resolvedLocation.lat, lon: resolvedLocation.lon });
        if (weatherData && weatherData.forecasts.length > 0) {
          weather = formatWeatherData(weatherData);
        }
      }

      // Season derives from the resolved location's hemisphere; omitted otherwise
      const season = resolvedLocation ? getSeasonForDate(now, resolvedLocation.lat >= 0) : null;

      // Calendar occurrences for the requested interval (next 7 days), expanded
      // with the same recurrence rules the calendar display uses
      const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const storedEvents = await storage.getEventsByUser(userId);
      const upcomingEvents = expandRecurringEvents(storedEvents, now, rangeEnd);

      // Project details when the request concerns a project
      const userProjects = await storage.getProjectsByUser(userId);
      const lowerMessage = message.toLowerCase();
      const mentionedProjects = userProjects.filter(project =>
        project.name && lowerMessage.includes(project.name.toLowerCase())
      );

      const contextLines: string[] = [];
      contextLines.push(`Current date and time at the farm: ${formatFarmDateTime(now, timeZone)} (${timeZone})`);
      contextLines.push(`Advice mode: ${adviceMode === "local" ? "local (location-specific)" : "general (not location-specific)"}`);
      if (resolvedLocation) {
        contextLines.push(`Farm location: ${resolvedLocation.name}`);
      }
      if (season) {
        contextLines.push(`Season at the farm location: ${season}`);
      }

      if (adviceMode === "local") {
        if (weather) {
          contextLines.push(`Weather for ${weather.location}:
- Source: Open-Meteo, fetched at ${weather.fetchedAt}
- Units: ${weather.units.temperature} temperature, ${weather.units.wind} wind speed, ${weather.units.precipitation} precipitation
- Current: ${weather.current.temperature}${weather.units.temperature}, ${weather.current.weatherDescription}, wind ${weather.current.wind} ${weather.units.wind}, humidity ${weather.current.humidity ?? "unavailable"}, precipitation ${weather.current.precipitation} ${weather.units.precipitation}
- Forecast by actual date:
${weather.forecast.map(day => `  - ${day.date}: ${day.weatherDescription}, high ${day.temp_max}${weather!.units.temperature}, low ${day.temp_min}${weather!.units.temperature}, precipitation ${day.precipitation} ${weather!.units.precipitation}`).join('\n')}`);
        } else {
          contextLines.push("Weather data is unavailable for this request. Do not invent weather measurements.");
        }
      } else {
        contextLines.push("Weather data is not part of this request. Do not state location-specific weather as fact.");
      }

      if (upcomingEvents.length > 0) {
        contextLines.push(`Calendar occurrences for the next 7 days (farm time zone):
${upcomingEvents.map(event => {
  const start = formatFarmDateTime(new Date(event.startDate), timeZone);
  const end = formatFarmDateTime(new Date(event.endDate), timeZone);
  return `- [Event #${event.id}] ${event.title}: ${start} to ${end}${event.checkWeather ? " (weather dependent)" : ""}${event.isRecurrenceInstance ? " (recurring occurrence)" : ""}`;
}).join('\n')}`);
      } else {
        contextLines.push("No calendar occurrences fall within the next 7 days (farm time zone).");
      }

      if (mentionedProjects.length > 0) {
        contextLines.push(`Project details for the projects this request concerns:
${mentionedProjects.map(project => `- [Project #${project.id}] ${project.name}: ${project.description || "No description"} (status: ${project.status})`).join('\n')}`);
      }

      // Farm profile ground truth: farm details plus fields, crops, equipment,
      // buildings, and staff (compact; long lists are truncated)
      const farmContextLines = await buildFarmContextLines(userId, storage);
      contextLines.push(...farmContextLines);

      const systemMessage = `You are a specialized AI assistant for agriculture and farming planning, focused on helping schedule and organize farm activities.

CONTEXT (built fresh for this request; it overrides anything from earlier in the conversation):
${contextLines.join('\n')}

CALENDAR MANAGEMENT CAPABILITIES:
- You can create events with create_calendar_event
- You can update existing events with update_calendar_event
- You can delete events with delete_calendar_event
- You can search for events with search_calendar_events (by keyword, date range, or project)
- You can organize events into projects with get_or_create_project

CRITICAL: When the user asks you to schedule an event, you MUST ALWAYS use the create_calendar_event function. NEVER respond as if you've scheduled something without explicitly calling this function.

Follow these strict requirements:
1. ONLY claim to have scheduled an event AFTER successfully using the create_calendar_event function
2. NEVER say phrases like "I've scheduled..." or "Event scheduled..." unless you've actually called the function
3. If you want to create an event, use the function FIRST, then mention it in your response
4. If you need a project to organize events, first call get_or_create_project, then create events with that project ID

For calendar events:
1. Always include a clear title
2. Set appropriate start and end times in ISO format (YYYY-MM-DDTHH:MM:SSZ)
3. Set checkWeather to true for outdoor activities
4. Include a detailed description with helpful tips — descriptions support Markdown, so for task instructions use structure (steps, materials, quantities, safety notes)
5. Set a location when relevant
6. Use recurringPattern for repeated activities (weekly scouting, every-3-day watering) instead of many duplicate events

When you use web research (search_web), ground your answer in what it returned and cite the source URLs. If research fails or is unavailable, say so plainly — never present invented specifics as researched facts.

Try to be helpful by suggesting optimal timing for agricultural activities based on the context above. In general advice mode, give advice that does not depend on location-specific weather.`;

      // Existing conversation history, minus stored system messages so old
      // context cannot override the fresh context above
      const historyMessages = (Array.isArray(conversation.messages) ? conversation.messages : [])
        .filter((msg: any) => msg.role !== "system");
      const updatedMessages: any[] = [
        ...historyMessages,
        { role: "user", content: message }
      ];

      // Add system message and conversation messages
      const apiMessages: any[] = [
        { role: "system", content: systemMessage },
        ...updatedMessages
      ];

      // Define tools for web search, weather data, and calendar/file management
      const tools = [
        {
          type: "function" as const,
          function: {
            name: "search_web",
            description: "Search the web for current or specific information that would be helpful for agricultural planning and scheduling",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "The search query. Be specific and include relevant agricultural terms."
                }
              },
              required: ["query"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "get_weather",
            description: "Get weather information for a specific location to provide agriculture-specific recommendations",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description: "The location (city, region, country) to get weather data for. Be specific for better results."
                }
              },
              required: ["location"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_calendar_event",
            description: "Create a new calendar event for agricultural activities",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "The title of the event (e.g., 'Turn Compost Piles', 'Plant Tomatoes')"
                },
                description: {
                  type: "string",
                  description: "Detailed description of the event, including any special instructions"
                },
                startDate: {
                  type: "string",
                  description: "Start date and time in ISO format (YYYY-MM-DDTHH:MM:SS)"
                },
                endDate: {
                  type: "string",
                  description: "End date and time in ISO format (YYYY-MM-DDTHH:MM:SS)"
                },
                location: {
                  type: "string",
                  description: "Location where the event will take place (e.g., 'North Field', 'Greenhouse')"
                },
                projectId: {
                  type: "number",
                  description: "ID of the project this event belongs to (optional)"
                },
                checkWeather: {
                  type: "boolean",
                  description: "Whether this event is weather-dependent (default: true for agricultural tasks)"
                },
                allDay: {
                  type: "boolean",
                  description: "Whether this is an all-day event (no specific start time)"
                },
                recurringPattern: {
                  type: "object",
                  description: "Make the event recurring (e.g., weekly scouting). Omit for one-time events.",
                  properties: {
                    frequency: { type: "string", enum: ["day", "week", "month", "year"], description: "How often it repeats" },
                    interval: { type: "number", description: "Every N intervals (1 = every week when frequency is week)" },
                    endDate: { type: "string", description: "ISO date the recurrence ends (optional)" }
                  },
                  required: ["frequency", "interval"]
                }
              },
              required: ["title", "startDate", "endDate"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "update_calendar_event",
            description: "Update one or more fields of an existing calendar event. Only send the fields that change.",
            parameters: {
              type: "object",
              properties: {
                eventId: {
                  type: "number",
                  description: "ID of the event to update"
                },
                title: {
                  type: "string",
                  description: "The updated title of the event"
                },
                description: {
                  type: "string",
                  description: "Updated detailed description of the event"
                },
                startDate: {
                  type: "string",
                  description: "Updated start date and time in ISO format (YYYY-MM-DDTHH:MM:SS)"
                },
                endDate: {
                  type: "string",
                  description: "Updated end date and time in ISO format (YYYY-MM-DDTHH:MM:SS)"
                },
                location: {
                  type: "string",
                  description: "Updated location where the event will take place"
                },
                projectId: {
                  type: "number",
                  description: "Updated ID of the project this event belongs to"
                },
                checkWeather: {
                  type: "boolean",
                  description: "Whether this event is weather-dependent"
                }
              },
              required: ["eventId"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "delete_calendar_event",
            description: "Delete an existing calendar event",
            parameters: {
              type: "object",
              properties: {
                eventId: {
                  type: "number",
                  description: "ID of the event to delete"
                }
              },
              required: ["eventId"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "search_calendar_events",
            description: "Search for calendar events by keyword, date range, or both",
            parameters: {
              type: "object",
              properties: {
                keyword: {
                  type: "string",
                  description: "Keyword to search in event titles and descriptions"
                },
                startDate: {
                  type: "string",
                  description: "Start date for filtering events (in ISO format YYYY-MM-DD)"
                },
                endDate: {
                  type: "string",
                  description: "End date for filtering events (in ISO format YYYY-MM-DD)"
                },
                projectId: {
                  type: "number",
                  description: "Filter events by project ID"
                }
              },
              required: []
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "get_or_create_project",
            description: "Get or create a project for organizing related agricultural activities",
            parameters: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "The name of the project (e.g., 'Spring Planting', 'Orchard Maintenance')"
                },
                description: {
                  type: "string",
                  description: "Description of the project's purpose and goals"
                }
              },
              required: ["name"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "read_user_file",
            description: "Read content from user's uploaded files (CSV, text documents, farm data, etc.)",
            parameters: {
              type: "object",
              properties: {
                fileId: {
                  type: "number",
                  description: "ID of the file to read"
                },
                filename: {
                  type: "string",
                  description: "Name of the file to read (alternative to fileId)"
                }
              },
              required: []
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "list_user_files",
            description: "List user's uploaded files and documents",
            parameters: {
              type: "object",
              properties: {
                fileType: {
                  type: "string",
                  description: "Filter by file type (csv, ics, pdf, txt, json, etc.)"
                },
                projectId: {
                  type: "number",
                  description: "Filter files by project ID"
                }
              },
              required: []
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "create_user_document",
            description: "Create a new document or note for the user",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Title of the document"
                },
                content: {
                  type: "string",
                  description: "Content of the document (supports Markdown)"
                },
                documentType: {
                  type: "string",
                  description: "Type of document (note, plan, report, analysis, etc.)"
                },
                projectId: {
                  type: "number",
                  description: "Optional project ID to associate with the document"
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Tags for organizing the document"
                }
              },
              required: ["title", "content"]
            }
          }
        },
        {
          type: "function" as const,
          function: {
            name: "list_user_documents",
            description: "List user's documents and notes",
            parameters: {
              type: "object",
              properties: {
                documentType: {
                  type: "string",
                  description: "Filter by document type (note, plan, report, analysis, etc.)"
                },
                projectId: {
                  type: "number",
                  description: "Filter documents by project ID"
                }
              },
              required: []
            }
          }
        }
      ];

      // Bounded tool loop: every model request uses the single configured
      // CHAT_MODEL (no model cascade). Execute ALL tool calls of a response,
      // preserving call IDs, then continue until a final reply or the limit.
      const mutations: MutationResult[] = [];
      let finalText: string | null = null;
      let unexecutedTools: string[] = [];
      let upstreamError: string | null = null;

      try {
        // Created inside the guarded region so a missing key or provider
        // outage surfaces as an explicit upstream failure, not a generic 500.
        const chat = await createChatClient();

        for (let step = 1; step <= TOOL_LOOP_LIMIT; step++) {
          const response = await chat.chat.completions.create({
            model: CHAT_MODEL,
            messages: apiMessages,
            tools
          });

          const choice = response.choices[0]?.message;
          if (!choice) {
            throw new Error("The model returned an empty response");
          }

          const toolCalls = choice.tool_calls ?? [];
          if (toolCalls.length === 0) {
            finalText = choice.content || "I'm sorry, I couldn't process your request.";
            break;
          }

          if (step === TOOL_LOOP_LIMIT) {
            // Out of budget: do not execute, do not claim completion
            unexecutedTools = toolCalls
              .map(call => call?.function?.name || "unknown_tool")
              .filter((name, idx, all) => all.indexOf(name) === idx);
            break;
          }

          apiMessages.push({
            role: "assistant",
            content: choice.content ?? null,
            tool_calls: toolCalls
          });
          // Persist the tool_calls turn too: a stored tool result must always
          // be preceded by the assistant message that requested it, or the
          // replayed history is an invalid model message sequence.
          updatedMessages.push({
            role: "assistant",
            content: choice.content ?? null,
            tool_calls: toolCalls
          });

          for (const toolCall of toolCalls) {
            if (!toolCall?.id || !toolCall?.function?.name) continue;
            const result = await executeToolCall(toolCall, userId);
            apiMessages.push({
              role: "tool",
              content: result.content,
              tool_call_id: toolCall.id
            });
            updatedMessages.push({
              role: "tool",
              content: result.content,
              tool_call_id: toolCall.id
            });
            if (result.mutation) {
              mutations.push(result.mutation);
            }
          }
        }
      } catch (err) {
        upstreamError = err instanceof Error ? err.message : String(err);
        console.error("Assistant model request failed:", upstreamError);
      }

      if (upstreamError) {
        if (mutations.length === 0) {
          return res.status(502).json({
            message: `The assistant model request failed: ${upstreamError}. No changes were saved.`
          });
        }
        // An upstream failure after successful writes must expose those writes
        // as completed; retrying will not duplicate them.
        finalText =
          `The assistant service failed partway through this request (${upstreamError}). ` +
          `Changes that were already saved: ${describeMutations(mutations.filter(m => m.ok))}. ` +
          `They are complete; retrying the same request will not duplicate them.`;
      }

      if (finalText === null) {
        const completed = mutations.filter(m => m.ok);
        const failed = mutations.filter(m => !m.ok);
        finalText =
          `I reached the tool execution limit of ${TOOL_LOOP_LIMIT} steps without a final reply.` +
          (unexecutedTools.length > 0
            ? ` Requested actions NOT executed: ${unexecutedTools.join(", ")}.`
            : "") +
          (completed.length > 0
            ? ` Completed changes: ${describeMutations(completed)}.`
            : " No changes were made.") +
          (failed.length > 0 ? ` Failed changes (not saved): ${failed.length}.` : "");
      }

      updatedMessages.push({ role: "assistant", content: finalText });

      const updatedConversation = await storage.updateConversation(id, updatedMessages);
      return res.status(200).json({ conversation: updatedConversation, mutations });
    } catch (err) {
      console.error("Chat message error:", err);
      return handleApiError(err, res);
    }
  });

  // User File Management Routes
  app.get("/api/files", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const fileType = req.query.fileType as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

      let files;
      if (fileType) {
        files = await storage.getUserFilesByType(userId, fileType);
      } else if (projectId !== undefined) {
        files = (await storage.getUserFilesByProject(projectId)).filter(file => file.userId === userId);
      } else {
        files = await storage.getUserFilesByUser(userId);
      }

      return res.status(200).json(files);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await ownedOr404(req, res, () => storage.getUserFile(id));
      if (!file) return;

      // Update last accessed timestamp
      await storage.updateUserFile(id, { lastAccessed: new Date() });

      return res.status(200).json(file);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/files", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const fileData = { ...req.body, userId };

      const validatedFile = insertUserFileSchema.parse(fileData);
      const newFile = await storage.createUserFile(validatedFile);

      return res.status(201).json(newFile);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await ownedOr404(req, res, () => storage.getUserFile(id));
      if (!file) return;

      const updates = updateUserFileRouteSchema.parse(req.body);
      if (updates.projectId !== undefined && updates.projectId !== null) {
        const projectError = await ownedProjectOrError(getUserId(req), updates.projectId);
        if (projectError) {
          return res.status(400).json({ message: projectError });
        }
      }
      const updatedFile = await storage.updateUserFile(id, updates);

      if (!updatedFile) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.status(200).json(updatedFile);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/files/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await ownedOr404(req, res, () => storage.getUserFile(id));
      if (!file) return;

      const deleted = await storage.deleteUserFile(id);

      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }

      return res.status(200).json({ message: "File deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/files/:id/content", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await ownedOr404(req, res, () => storage.getUserFile(id));
      if (!file) return;

      // Extract content from metadata field
      let content = '';
      if (file.metadata && typeof file.metadata === 'object') {
        const metadata = file.metadata as any;
        content = metadata.content || metadata.rawContent || '';
      }

      // Return the file content as plain text
      return res.status(200).type('text/plain').send(content);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // User Document Management Routes
  app.get("/api/documents", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const documentType = req.query.documentType as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

      let documents;
      if (documentType) {
        documents = await storage.getUserDocumentsByType(userId, documentType);
      } else if (projectId !== undefined) {
        documents = (await storage.getUserDocumentsByProject(projectId)).filter(doc => doc.userId === userId);
      } else {
        documents = await storage.getUserDocumentsByUser(userId);
      }

      return res.status(200).json(documents);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await ownedOr404(req, res, () => storage.getUserDocument(id));
      if (!document) return;

      return res.status(200).json(document);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/documents", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const documentData = { ...req.body, userId };

      const validatedDocument = insertUserDocumentSchema.parse(documentData);
      const newDocument = await storage.createUserDocument(validatedDocument);

      return res.status(201).json(newDocument);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await ownedOr404(req, res, () => storage.getUserDocument(id));
      if (!document) return;

      const updates = updateUserDocumentRouteSchema.parse(req.body);
      if (updates.projectId !== undefined && updates.projectId !== null) {
        const projectError = await ownedProjectOrError(getUserId(req), updates.projectId);
        if (projectError) {
          return res.status(400).json({ message: projectError });
        }
      }
      const updatedDocument = await storage.updateUserDocument(id, updates);

      if (!updatedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }

      return res.status(200).json(updatedDocument);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/documents/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await ownedOr404(req, res, () => storage.getUserDocument(id));
      if (!document) return;

      const deleted = await storage.deleteUserDocument(id);

      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }

      return res.status(200).json({ message: "Document deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Farm profile routes — one farm per user, get-or-create semantics on PUT
  app.get("/api/farm", requireAuth, async (req: Request, res: Response) => {
    try {
      const farm = await storage.getFarmByUser(getUserId(req));
      return res.status(200).json({ farm: farm ?? null });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/farm", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);

      // Strict schema: rejects attempts to change userId through the body
      const farmData = upsertFarmRouteSchema.parse(req.body);

      const existing = await storage.getFarmByUser(userId);
      const farm = existing
        ? await storage.updateFarm(existing.id, farmData)
        : await storage.createFarm({ ...farmData, userId });

      if (!farm) {
        return res.status(404).json({ message: "Farm not found" });
      }

      return res.status(200).json(farm);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Field routes
  app.get("/api/fields", requireAuth, async (req: Request, res: Response) => {
    try {
      const fields = await storage.getFieldsByUser(getUserId(req));
      return res.status(200).json(fields);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/fields", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const fieldData = createFieldRouteSchema.parse(req.body);
      const field = await storage.createField({ ...fieldData, userId });
      return res.status(201).json(field);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/fields/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const field = await ownedOr404(req, res, () => storage.getField(id));
      if (!field) return;

      const updates = updateFieldRouteSchema.parse(req.body);
      const updatedField = await storage.updateField(id, updates);

      if (!updatedField) {
        return res.status(404).json({ message: "Field not found" });
      }

      return res.status(200).json(updatedField);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/fields/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const field = await ownedOr404(req, res, () => storage.getField(id));
      if (!field) return;

      await storage.deleteField(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Crop routes (fieldId must reference one of the user's own fields)
  app.get("/api/crops", requireAuth, async (req: Request, res: Response) => {
    try {
      const crops = await storage.getCropsByUser(getUserId(req));
      return res.status(200).json(crops);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/crops", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const cropData = createCropRouteSchema.parse(req.body);

      if (cropData.fieldId !== undefined && cropData.fieldId !== null) {
        const fieldError = await ownedFieldOrError(userId, cropData.fieldId);
        if (fieldError) {
          return res.status(400).json({ message: fieldError });
        }
      }

      const crop = await storage.createCrop({ ...cropData, userId });
      return res.status(201).json(crop);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/crops/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const crop = await ownedOr404(req, res, () => storage.getCrop(id));
      if (!crop) return;

      const updates = updateCropRouteSchema.parse(req.body);

      if (updates.fieldId !== undefined && updates.fieldId !== null) {
        const fieldError = await ownedFieldOrError(getUserId(req), updates.fieldId);
        if (fieldError) {
          return res.status(400).json({ message: fieldError });
        }
      }

      const updatedCrop = await storage.updateCrop(id, updates);

      if (!updatedCrop) {
        return res.status(404).json({ message: "Crop not found" });
      }

      return res.status(200).json(updatedCrop);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/crops/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const crop = await ownedOr404(req, res, () => storage.getCrop(id));
      if (!crop) return;

      await storage.deleteCrop(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Equipment routes
  app.get("/api/equipment", requireAuth, async (req: Request, res: Response) => {
    try {
      const equipment = await storage.getEquipmentByUser(getUserId(req));
      return res.status(200).json(equipment);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/equipment", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const equipmentData = createEquipmentRouteSchema.parse(req.body);
      const item = await storage.createEquipment({ ...equipmentData, userId });
      return res.status(201).json(item);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/equipment/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const item = await ownedOr404(req, res, () => storage.getEquipment(id));
      if (!item) return;

      const updates = updateEquipmentRouteSchema.parse(req.body);
      const updatedItem = await storage.updateEquipment(id, updates);

      if (!updatedItem) {
        return res.status(404).json({ message: "Equipment not found" });
      }

      return res.status(200).json(updatedItem);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/equipment/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const item = await ownedOr404(req, res, () => storage.getEquipment(id));
      if (!item) return;

      await storage.deleteEquipment(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Building routes
  app.get("/api/buildings", requireAuth, async (req: Request, res: Response) => {
    try {
      const buildings = await storage.getBuildingsByUser(getUserId(req));
      return res.status(200).json(buildings);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/buildings", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const buildingData = createBuildingRouteSchema.parse(req.body);
      const building = await storage.createBuilding({ ...buildingData, userId });
      return res.status(201).json(building);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/buildings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const building = await ownedOr404(req, res, () => storage.getBuilding(id));
      if (!building) return;

      const updates = updateBuildingRouteSchema.parse(req.body);
      const updatedBuilding = await storage.updateBuilding(id, updates);

      if (!updatedBuilding) {
        return res.status(404).json({ message: "Building not found" });
      }

      return res.status(200).json(updatedBuilding);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/buildings/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const building = await ownedOr404(req, res, () => storage.getBuilding(id));
      if (!building) return;

      await storage.deleteBuilding(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Staff routes
  app.get("/api/staff", requireAuth, async (req: Request, res: Response) => {
    try {
      const staff = await storage.getStaffByUser(getUserId(req));
      return res.status(200).json(staff);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/staff", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const staffData = createStaffRouteSchema.parse(req.body);
      const member = await storage.createStaffMember({ ...staffData, userId });
      return res.status(201).json(member);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const member = await ownedOr404(req, res, () => storage.getStaffMember(id));
      if (!member) return;

      const updates = updateStaffRouteSchema.parse(req.body);
      const updatedMember = await storage.updateStaffMember(id, updates);

      if (!updatedMember) {
        return res.status(404).json({ message: "Staff member not found" });
      }

      return res.status(200).json(updatedMember);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/staff/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const member = await ownedOr404(req, res, () => storage.getStaffMember(id));
      if (!member) return;

      await storage.deleteStaffMember(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
