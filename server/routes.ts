import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertProjectSchema, insertEventSchema, insertConversationSchema, insertUserFileSchema, insertUserDocumentSchema, WeatherForecast } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { searchWeb } from "./perplexityApi";
import { fetchComprehensiveWeather, getAgricultureRecommendations, getCurrentWeather } from "./openWeatherApi";
import { eq } from "drizzle-orm";
import { events, Event } from "@shared/schema";

// Helper function to determine the current season based on date
function getSeasonForDate(date: Date): string {
  const month = date.getMonth();
  const day = date.getDate();
  const northernHemisphere = true; // Default to northern hemisphere

  // Adjust seasons based on hemisphere
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

// Define the formatted weather data type
interface FormattedWeatherData {
  location: string;
  current: WeatherForecast;
  forecast: WeatherForecast[];
}

// Helper function to format weather data
function formatWeatherData(weatherData: { locationName: string, forecasts: WeatherForecast[] }): FormattedWeatherData {
  const [current, ...forecast] = weatherData.forecasts;
  if (!current) {
    throw new Error('No weather data available');
  }
  return {
    location: weatherData.locationName,
    current: { ...current, isCurrent: true },
    forecast: forecast.map((day: WeatherForecast) => ({ ...day, isCurrent: false }))
  };
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

  // User routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const existingUser = await storage.getUserByUsername(userData.username);

      if (existingUser) {
        return res.status(409).json({ message: "Username already exists" });
      }

      const user = await storage.createUser(userData);
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

      if (!user || user.password !== password) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Don't return password in response
      const { password: _, ...userResponse } = user;

      return res.status(200).json(userResponse);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/users/me", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll return the first user
      const user = await storage.getUser(1);

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
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;
      const projects = await storage.getProjectsByUser(userId);
      return res.status(200).json(projects);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json(project);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/projects", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;
      const projectData = insertProjectSchema.parse({ ...req.body, userId });
      const project = await storage.createProject(projectData);
      return res.status(201).json(project);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      const updatedProject = await storage.updateProject(id, req.body);
      return res.status(200).json(updatedProject);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/projects/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ message: "Project not found" });
      }

      await storage.deleteProject(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Event routes
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;

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

      // If projectId is provided, filter events by project
      if (req.query.projectId) {
        const projectId = parseInt(req.query.projectId as string);
        const events = await storage.getEventsByProject(projectId);
        return res.status(200).json(events);
      }

      // Otherwise, get all events for the user
      const events = await storage.getEventsByUser(userId);
      return res.status(200).json(events);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      return res.status(200).json(event);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/events", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;

      // Handle both string and Date objects for dates
      const { startDate, endDate, ...restBody } = req.body;

      // Convert dates if they're strings
      const parsedData = {
        ...restBody,
        userId,
        startDate: typeof startDate === 'string' ? new Date(startDate) : startDate,
        endDate: typeof endDate === 'string' ? new Date(endDate) : endDate
      };

      // Now parse with the schema
      const eventData = insertEventSchema.parse(parsedData);
      const event = await storage.createEvent(eventData);
      return res.status(201).json(event);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      const updatedEvent = await storage.updateEvent(id, req.body);
      return res.status(200).json(updatedEvent);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const event = await storage.getEvent(id);

      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      await storage.deleteEvent(id);
      return res.status(204).end();
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Weather routes
  app.get("/api/weather", async (req: Request, res: Response) => {
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

      const formattedData = formatWeatherData(weatherData);
      return res.status(200).json(formattedData);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Update the agriculture recommendations endpoint
  app.get("/api/weather/agriculture", async (req: Request, res: Response) => {
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

      const recommendations = getAgricultureRecommendations(weatherData);
      return res.status(200).json({ recommendations });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Real-time weather data API for the AI assistant
  app.get("/api/weather-data", async (req: Request, res: Response) => {
    try {
      // Check if we're doing reverse geocoding from coordinates
      if (req.query.lat && req.query.lon) {
        const lat = parseFloat(req.query.lat as string);
        const lon = parseFloat(req.query.lon as string);

        if (isNaN(lat) || isNaN(lon)) {
          return res.status(400).json({ message: "Invalid coordinates" });
        }

        try {
          // Get weather data which includes location name
          const weatherData = await getCurrentWeather(lat, lon);

          if (!weatherData) {
            return res.status(404).json({ message: "Could not retrieve location data" });
          }

          return res.status(200).json({ 
            location: weatherData.name + (weatherData.sys?.country ? `, ${weatherData.sys.country}` : ""),
            weather: weatherData 
          });
        } catch (err) {
          console.error("Error in reverse geocoding:", err);
          return res.status(500).json({ message: "Error retrieving location from coordinates" });
        }
      }

      // Standard weather data request
      const location = (req.query.location as string);

      if (!location) {
        return res.status(400).json({ message: "Location parameter is required" });
      }

      const weatherData = await fetchComprehensiveWeather(location);

      if (!weatherData) {
        return res.status(404).json({ message: "Could not retrieve weather data for this location" });
      }

      return res.status(200).json(weatherData);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Web search route
  app.post("/api/search", async (req: Request, res: Response) => {
    try {
      const { query } = z.object({
        query: z.string()
      }).parse(req.body);

      const searchResults = await searchWeb({ query });
      return res.status(200).json({ results: searchResults });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Assistant/Conversation routes
  app.get("/api/conversations", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;
      const conversations = await storage.getConversationsByUser(userId);
      return res.status(200).json(conversations);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      return res.status(200).json(conversation);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      // For demo purposes, we'll use user 1
      const userId = 1;

      // If no messages are provided, add a weather-aware agricultural greeting
      let messages = req.body.messages || [];

      // Define message interface
      interface ConversationMessage {
        role: string;
        content: string;
        tool_calls?: any[];
        tool_call_id?: string;
      }

      if (messages.length === 0 || (messages.length === 1 && messages[0].role === "system")) {
        // Get default location
        const userLocation = "New York, USA"; // Default location - in real app would be user's actual location

        // Get weather data
        const weatherData = await fetchComprehensiveWeather(userLocation);

        // Determine current season
        const now = new Date();
        const currentSeason = getSeasonForDate(now);

        // Generate appropriate seasonal greeting
        let seasonalActivities = "";

        switch(currentSeason) {
          case "Spring":
            seasonalActivities = "soil preparation, early crop planting, and equipment maintenance";
            break;
          case "Summer":
            seasonalActivities = "irrigation management, pest control, and vegetable harvesting";
            break;
          case "Fall":
            seasonalActivities = "harvest planning, soil testing, and winter preparation";
            break;
          case "Winter":
            seasonalActivities = "crop planning, equipment repairs, and seed ordering";
            break;
        }

        // Create assistant greeting
        const weatherInfo = weatherData && weatherData.forecasts.length > 0 ? 
          `The current weather in ${userLocation} is ${weatherData.forecasts[0].temperature}°F with ${weatherData.forecasts[0].weatherDescription}. ` : 
          "";

        const greeting = `Hello! I'm your Farm Friend agricultural assistant. ${weatherInfo}We're currently in ${currentSeason}, which is typically the time for ${seasonalActivities} in your region.

How can I help with your agricultural planning today?`;

        // Add assistant message if not already present
        if (!messages.some((msg: ConversationMessage) => msg.role === "assistant")) {
          messages.push({
            role: "assistant",
            content: greeting
          });
        }
      }

      const conversationData = insertConversationSchema.parse({ messages, userId });
      const conversation = await storage.createConversation(conversationData);
      return res.status(201).json(conversation);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const conversation = await storage.getConversation(id);

      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      const { message } = z.object({
        message: z.string()
      }).parse(req.body);

      // Add user message
      const updatedMessages = [
        ...(Array.isArray(conversation.messages) ? conversation.messages : []),
        { role: "user", content: message }
      ];

      // Get AI response from OpenAI API
      const OpenAI = await import("openai");
      const openai = new OpenAI.default({
        apiKey: process.env.OPENAI_API_KEY
      });

      // Get location data for context from request headers or use default
      const userAgent = req.headers['user-agent'] || '';
      let userLocation = 'Unknown Location';

      // Try to get location from query or cookies, or use default
      if (req.query.location) {
        userLocation = req.query.location as string;
      } else if (req.cookies && req.cookies.userLocation) {
        userLocation = req.cookies.userLocation;
      } else {
        // Default location if not provided
        userLocation = 'New York, USA';
      }

      // Get real weather data and context directly instead of going through the API
      // This avoids port issues and is more efficient

      // Get weather data
      const weatherData = await fetchComprehensiveWeather(userLocation);

      // Get user's calendar events (using default user ID 1)
      const userId = 1;
      const userEvents = await storage.getEventsByUser(userId);

      // Determine current season
      const now = new Date();
      const currentSeason = getSeasonForDate(now);

      // Build context data directly - similar structure to the /api/assistant/context endpoint
      const contextData = {
        timestamp: now.toISOString(),
        location: userLocation,
        season: currentSeason,
        weather: weatherData && weatherData.forecasts.length > 0 ? {
          current: {
            temperature: weatherData.forecasts[0].temperature, // Already in Fahrenheit
            conditions: weatherData.forecasts[0].weatherDescription,
            humidity: weatherData.forecasts[0].humidity,
            wind: Math.round(weatherData.forecasts[0].wind) // Already in mph
          },
          forecast: weatherData.forecasts.slice(0, 6).map((day: any) => ({
            date: day.date,
            temperature: day.temperature, // Already in Fahrenheit
            conditions: day.weatherDescription
          }))
        } : null,
        events: userEvents.map(event => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          isWeatherDependent: event.checkWeather
        }))
      };

      // Prepare messages for API
      const systemMessage = `You are a specialized AI assistant for agriculture and farming planning, focused on helping schedule and organize farm activities.

Current date and time: ${new Date(contextData.timestamp).toLocaleString()}
Current season: ${contextData.season}
User location: ${contextData.location}
${contextData.weather ? `
Current weather: ${contextData.weather.current.temperature}°F, ${contextData.weather.current.conditions}
Humidity: ${contextData.weather.current.humidity}%
Wind: ${contextData.weather.current.wind} mph

Weather forecast for the next ${contextData.weather.forecast.length} days:
${contextData.weather.forecast.map((day: any, index: number) => 
  `- Day ${index + 1}: ${day.temperature}°F, ${day.conditions}`
).join('\n')}
` : ''}
${contextData.events && contextData.events.length > 0 ? `
Upcoming calendar events:
${contextData.events.slice(0, 5).map(event => {
  const startDate = new Date(event.startDate);
  return `- ${event.title} on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}${event.isWeatherDependent ? ' (Weather dependent)' : ''}`;
}).join('\n')}
` : ''}

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
4. Include a detailed description with helpful tips
5. Set a location when relevant

Try to be helpful by suggesting optimal timing for agricultural activities based on the current season and weather conditions.`;

      // Add system message and user's message
      const apiMessages = [
        { role: "system", content: systemMessage },
        ...updatedMessages
      ];

      // Define tools for web search and weather data
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
            description: "Update an existing calendar event",
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
        },
        {
          type: "function" as const,
          function: {
            name: "analyze_farm_data",
            description: "Analyze user's uploaded farm data files (yield data, weather logs, soil reports, etc.)",
            parameters: {
              type: "object",
              properties: {
                fileId: {
                  type: "number",
                  description: "ID of the file to analyze"
                },
                analysisType: {
                  type: "string",
                  description: "Type of analysis (yield_analysis, weather_patterns, soil_health, growth_tracking, etc.)"
                }
              },
              required: ["fileId", "analysisType"]
            }
          }
        }
      ];

      // Call OpenAI API with model fallback
      let response;
      try {
        // First attempt with o3-mini model
        response = await openai.chat.completions.create({
          model: "o3-mini",
          messages: apiMessages,
          reasoning_effort: "low", // New parameter for o3-mini: low, medium, or high
          max_completion_tokens: 500, // Use max_completion_tokens for o3-mini models
          tools: tools
          // Note: o3-mini doesn't support temperature parameter
        });
      } catch (modelError: unknown) {
        const errorMessage = modelError instanceof Error ? modelError.message : String(modelError);
        console.warn("o3-mini model error, falling back to gpt-4o:", errorMessage);
        try {
          // Fallback to gpt-4o
          response = await openai.chat.completions.create({
            model: "gpt-4.1",
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500,
            tools: tools
          });
        } catch (fallbackError: unknown) {
          const fallbackErrorMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.warn("gpt-4o model error, falling back to gpt-3.5-turbo:", fallbackErrorMessage);
          // Final fallback to gpt-3.5-turbo
          response = await openai.chat.completions.create({
            model: "gpt-4.1-mini",
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500,
            tools: tools
          });
        }
      }

      // Handle function calling if the model calls a tool
      if (response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0) {
        const toolCall = response.choices[0].message.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        // Add the assistant's tool call message to the conversation
        updatedMessages.push({
          role: "assistant",
          content: null,
          tool_calls: [toolCall]
        } as any);

        // Add the assistant message with tool_calls to apiMessages
        (apiMessages as any).push({
          role: "assistant",
          content: null, 
          tool_calls: [{
            id: toolCall.id,
            type: "function",
            function: {
              name: functionName,
              arguments: toolCall.function.arguments
            }
          }]
        });

        let toolResponse = "";

        // Handle different tool types
        if (functionName === "search_web") {
          const searchQuery = functionArgs.query;
          console.log("Performing web search for query:", searchQuery);

          // Add a visible message to the user about the search
          updatedMessages.push({
            role: "assistant",
            content: `I'll search for information about: ${searchQuery}`
          });

          // Execute the web search
          toolResponse = await searchWeb({ query: searchQuery });

        } else if (functionName === "get_weather") {
          const location = functionArgs.location;
          console.log("Getting weather data for location:", location);

          // Add a visible message to the user about getting weather
          updatedMessages.push({
            role: "assistant",
            content: `I'll check the current weather and forecast for ${location}`
          });

          // Get weather data
          const weatherData = await fetchComprehensiveWeather(location);

          if (weatherData) {
            // Get agricultural recommendations based on weather
            const recommendations = getAgricultureRecommendations(weatherData);

            // Combine weather data and recommendations
            toolResponse = JSON.stringify({
              weather: weatherData,
              recommendations: recommendations
            });
          } else {
            toolResponse = "I couldn't retrieve weather information for that location. Please check the spelling or try a different location.";
          }
        } else if (functionName === "create_calendar_event") {
          const eventData = functionArgs;
          console.log("Creating calendar event from assistant:", eventData);

          // Validate the event data
          const validatedEvent = insertEventSchema.parse({
            ...eventData,
            startDate: new Date(eventData.startDate),
            endDate: new Date(eventData.endDate),
            userId: 1, // Default user ID
          });

          // Insert the event using the storage interface
          const newEvent = await storage.createEvent(validatedEvent);

          toolResponse = JSON.stringify({
            success: true,
            event: newEvent
          });
        } else if (functionName === "update_calendar_event") {
          const eventData = functionArgs;
          console.log("Updating calendar event from assistant:", eventData);

          // Validate the event data
          const validatedEvent = insertEventSchema.parse({
            ...eventData,
            userId: 1, // Default user ID
          });

          // Update the event using the storage interface
          const updatedEvent = await storage.updateEvent(eventData.eventId, validatedEvent);

          toolResponse = JSON.stringify({
            success: true,
            event: updatedEvent
          });
        } else if (functionName === "delete_calendar_event") {
          console.log("Deleting calendar event from assistant:", functionArgs.eventId);

          // Delete the event using the storage interface
          await storage.deleteEvent(functionArgs.eventId);

          toolResponse = JSON.stringify({
            success: true,
            message: "Event deleted successfully"
          });
        } else if (functionName === "search_calendar_events") {
          console.log("Searching calendar events:", functionArgs);

          // Default to user 1 for demo
          const userId = 1;
          let events = [];

          // If we have a date range, use that for searching
          if (functionArgs.startDate && functionArgs.endDate) {
            const startDate = new Date(functionArgs.startDate);
            const endDate = new Date(functionArgs.endDate);
            events = await storage.getEventsByDateRange(userId, startDate, endDate);
          } 
          // If we have a project ID, filter by project
          else if (functionArgs.projectId) {
            events = await storage.getEventsByProject(functionArgs.projectId);
          }
          // Otherwise, get all events
          else {
            events = await storage.getEventsByUser(userId);
          }

          // If we have a keyword, filter the results
          if (functionArgs.keyword && events.length > 0) {
            const keyword = functionArgs.keyword.toLowerCase();
            events = events.filter(event => 
              (event.title && event.title.toLowerCase().includes(keyword)) || 
              (event.description && event.description.toLowerCase().includes(keyword))
            );
          }

          toolResponse = JSON.stringify({
            success: true,
            events: events
          });
        } else if (functionName === "get_or_create_project") {
          const projectData = functionArgs;
          console.log("Getting or creating project from assistant:", projectData.name);

          // Get all projects for user 1
          const allProjects = await storage.getProjectsByUser(1);

          // Check if project already exists
          const existingProject = allProjects.find(project => 
            project.name.toLowerCase() === projectData.name.toLowerCase()
          );

          if (existingProject) {
            toolResponse = JSON.stringify({
              success: true,
              project: existingProject,
              isNew: false
            });
          } else {
            // Create new project using the storage interface
            const newProject = await storage.createProject({
              name: projectData.name,
              description: projectData.description || "",
              status: "active",
              startDate: new Date(),
              endDate: null,
              userId: 1 // Default user ID
            });

            toolResponse = JSON.stringify({
              success: true,
              project: newProject,
              isNew: true
            });
          }
        } else if (functionName === "read_user_file") {
          const { fileId, filename } = functionArgs;
          console.log("Reading user file:", fileId || filename);

          let file;
          if (fileId) {
            file = await storage.getUserFile(fileId);
          } else if (filename) {
            // Find file by name for the user
            const userFiles = await storage.getUserFilesByUser(1);
            file = userFiles.find(f => f.originalName === filename || f.filename === filename);
          }

          if (file) {
            toolResponse = JSON.stringify({
              success: true,
              file: {
                id: file.id,
                filename: file.originalName,
                fileType: file.fileType,
                size: file.fileSize,
                uploadDate: file.uploadDate,
                description: file.description,
                metadata: file.metadata
              },
              content: `File content would be read from: ${file.filePath}` // Placeholder for actual file reading
            });
          } else {
            toolResponse = JSON.stringify({
              success: false,
              error: "File not found"
            });
          }
        } else if (functionName === "list_user_files") {
          const { fileType, projectId } = functionArgs;
          console.log("Listing user files:", { fileType, projectId });

          let files;
          if (fileType) {
            files = await storage.getUserFilesByType(1, fileType);
          } else if (projectId) {
            files = await storage.getUserFilesByProject(projectId);
          } else {
            files = await storage.getUserFilesByUser(1);
          }

          toolResponse = JSON.stringify({
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
          });
        } else if (functionName === "create_user_document") {
          const { title, content, documentType, projectId, tags } = functionArgs;
          console.log("Creating user document:", title);

          const documentData = {
            userId: 1, // Default user ID
            title,
            content,
            documentType: documentType || "note",
            projectId: projectId || null,
            tags: tags || null,
            isPublic: false
          };

          const newDocument = await storage.createUserDocument(documentData);
          
          toolResponse = JSON.stringify({
            success: true,
            document: {
              id: newDocument.id,
              title: newDocument.title,
              documentType: newDocument.documentType,
              createdAt: newDocument.createdAt,
              projectId: newDocument.projectId
            }
          });
        } else if (functionName === "list_user_documents") {
          const { documentType, projectId } = functionArgs;
          console.log("Listing user documents:", { documentType, projectId });

          let documents;
          if (documentType) {
            documents = await storage.getUserDocumentsByType(1, documentType);
          } else if (projectId) {
            documents = await storage.getUserDocumentsByProject(projectId);
          } else {
            documents = await storage.getUserDocumentsByUser(1);
          }

          toolResponse = JSON.stringify({
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
          });
        } else if (functionName === "analyze_farm_data") {
          const { fileId, analysisType } = functionArgs;
          console.log("Analyzing farm data:", { fileId, analysisType });

          const file = await storage.getUserFile(fileId);
          if (!file) {
            toolResponse = JSON.stringify({
              success: false,
              error: "File not found"
            });
          } else {
            // This is a placeholder for actual data analysis logic
            // In a real implementation, you would read the file content and perform the analysis
            const analysisResult = {
              yield_analysis: "Based on your crop yield data, average productivity is 15% above regional benchmarks.",
              weather_patterns: "Weather data shows optimal growing conditions during spring months with consistent precipitation.",
              soil_health: "Soil test results indicate good nitrogen levels but recommend phosphorus supplementation.",
              growth_tracking: "Plant growth rates are within expected parameters for this variety and climate zone."
            };

            toolResponse = JSON.stringify({
              success: true,
              analysis: {
                fileId: file.id,
                filename: file.originalName,
                analysisType,
                result: analysisResult[analysisType as keyof typeof analysisResult] || "Analysis completed successfully.",
                timestamp: new Date().toISOString()
              }
            });
          }
        }

        // Add the tool response to messages array
        updatedMessages.push({
          role: "tool",
          content: toolResponse,
          tool_call_id: toolCall.id
        });

        // Add tool message to API messages
        apiMessages.push({
          role: "tool",
          content: toolResponse,
          tool_call_id: toolCall.id
        });

        // Get a second response from the model with the tool results
        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4o", // Use gpt-4o for handling tool results (more reliable)
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 800,
          tools: tools // Keep providing tools for follow-up responses
        });

        // Get the AI response that incorporates the tool results
        const aiResponse = secondResponse.choices[0].message.content || "I'm sorry, I couldn't process your request.";

        // Add the final AI response to conversation
        updatedMessages.push({ role: "assistant", content: aiResponse });

      } else {
        // Handle normal non-function response
        const aiResponse = response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
        updatedMessages.push({ role: "assistant", content: aiResponse });
      }

      const updatedConversation = await storage.updateConversation(id, updatedMessages);
      return res.status(200).json(updatedConversation);
    } catch (err) {
      console.error("OpenAI API Error:", err);
      return handleApiError(err, res);
    }
  });

  // Get calendar events as ICS file
  app.get("/api/events/ics", async (req: Request, res: Response) => {
    try {
      // Demo user id = 1 for simplicity (in this demo app we auto-login as demo user)
      const userId = 1;

      // Get all events for the user
      const userEvents = await storage.getEventsByUser(userId);

      // Convert to ICS format
      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Agri-Cal//Farm Friend//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];

      userEvents.forEach(event => {
        const startDate = new Date(event.startDate);
        const endDate = new Date(event.endDate);

        // Format dates as YYYYMMDDTHHMMSSZ
        const formatICSDate = (date: Date) => {
          return date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 15) + 'Z';
        };

        const eventBlock = [
          'BEGIN:VEVENT',
          `UID:${event.id}@agriplanner.com`,
          `DTSTAMP:${formatICSDate(new Date())}`,
          `DTSTART:${formatICSDate(startDate)}`,
          `DTEND:${formatICSDate(endDate)}`,
          `SUMMARY:${event.title}`,
        ];

        if (event.description) {
          eventBlock.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
        }

        if (event.location) {
          eventBlock.push(`LOCATION:${event.location}`);
        }

        // Add custom properties for Agri-Cal specific features
        if (event.checkWeather) {
          eventBlock.push('X-AGRICAL-CHECKWEATHER:TRUE');
        }

        if (event.projectId) {
          eventBlock.push(`X-AGRICAL-PROJECTID:${event.projectId}`);
        }

        eventBlock.push('END:VEVENT');
        icsContent.push(...eventBlock);
      });

      icsContent.push('END:VCALENDAR');

      // Set the response headers for an ICS file download
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=farm-calendar.ics');

      return res.status(200).send(icsContent.join('\r\n'));
    } catch (err) {
      console.error("Error generating ICS file:", err);
      return handleApiError(err, res);
    }
  });

  // Get contextual information for the assistant
  app.get("/api/assistant/context", async (req: Request, res: Response) => {
    try {
      // Get location from query params or use default
      const location = (req.query.location as string) || "New York";
      const userId = 1; // Default demo user

      // Get weather data
      const weatherData = await fetchComprehensiveWeather(location);
      if (!weatherData) {
        return res.status(404).json({ message: "Could not retrieve weather data for this location" });
      }

      // Get user's calendar events
      const userEvents = await storage.getEventsByUser(userId);

      // Determine current season
      const currentDate = new Date();
      const currentSeason = getSeasonForDate(currentDate);

      // Build context object
      const context = {
        timestamp: currentDate.toISOString(),
        location: location,
        season: currentSeason,
        weather: {
          current: {
            temperature: weatherData.forecasts[0].temperature, // Already in Fahrenheit
            conditions: weatherData.forecasts[0].weatherDescription,
            humidity: weatherData.forecasts[0].humidity,
            wind: Math.round(weatherData.forecasts[0].wind) // Already in mph
          },
          forecast: weatherData.forecasts.slice(0, 6).map((day: any) => ({
            date: day.date,
            temperature: day.temperature, // Already in Fahrenheit
            conditions: day.weatherDescription
          }))
        },
        events: userEvents.map(event => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          endDate: event.endDate,
          isWeatherDependent: event.checkWeather
        }))
      };

      return res.status(200).json(context);
    } catch (err) {
      console.error("Error fetching assistant context:", err);
      return handleApiError(err, res);
    }
  });

  // Assistant function calling API endpoints
  // Create a calendar event
  app.post("/api/assistant/functions/create-event", async (req: Request, res: Response) => {
    try {
      const eventData = req.body;
      console.log("Creating calendar event from assistant:", eventData);

      // Handle both string and Date objects for dates
      const { startDate, endDate, ...restData } = eventData;

      // Convert dates if they're strings
      const parsedData = {
        ...restData,
        userId: 1, // Default user ID
        startDate: typeof startDate === 'string' ? new Date(startDate) : startDate,
        endDate: typeof endDate === 'string' ? new Date(endDate) : endDate
      };

      // Validate the event data
      const validatedEvent = insertEventSchema.parse(parsedData);

      // Insert the event using the storage interface
      const newEvent = await storage.createEvent(validatedEvent);

      return res.status(200).json({
        success: true,
        event: newEvent
      });
    } catch (err) {
      console.error("Error creating event from assistant:", err);
      return handleApiError(err, res);
    }
  });

  // Get or create a project
  app.post("/api/assistant/functions/get-or-create-project", async (req: Request, res: Response) => {
    try {
      const { name, description } = req.body;
      console.log("Getting or creating project from assistant:", name);

      // Get all projects for user 1
      const allProjects = await storage.getProjectsByUser(1);

      // Check if project already exists
      const existingProject = allProjects.find(project => 
        project.name.toLowerCase() === name.toLowerCase()
      );

      if (existingProject) {
        return res.status(200).json({
          success: true,
          project: existingProject,
          isNew: false
        });
      }

      // Create new project using the storage interface
      const newProject = await storage.createProject({
        name,
        description: description || "",
        status: "active",
        startDate: new Date(),
        endDate: null,
        userId: 1 // Default user ID
      });

      return res.status(200).json({
        success: true,
        project: newProject,
        isNew: true
      });
    } catch (err) {
      console.error("Error getting or creating project from assistant:", err);
      return handleApiError(err, res);
    }
  });

  // Create multiple calendar events in a batch
  app.post("/api/assistant/functions/create-events-batch", async (req: Request, res: Response) => {
    try {
      const { events: eventsBatch } = req.body;
      console.log("Creating calendar events batch from assistant:", eventsBatch.length, "events");

      const createdEvents = [];

      // Process each event
      for (const eventData of eventsBatch) {
        // Handle both string and Date objects for dates
        const { startDate, endDate, ...restData } = eventData;

        // Convert dates if they're strings
        const parsedData = {
          ...restData,
          userId: 1, // Default user ID
          startDate: typeof startDate === 'string' ? new Date(startDate) : startDate,
          endDate: typeof endDate === 'string' ? new Date(endDate) : endDate
        };

        // Validate the event data
        const validatedEvent = insertEventSchema.parse(parsedData);

        // Insert the event
        const newEvent = await storage.createEvent(validatedEvent);
        createdEvents.push(newEvent);
      }

      return res.status(200).json({
        success: true,
        events: createdEvents
      });
    } catch (err) {
      console.error("Error creating events batch from assistant:", err);
      return handleApiError(err, res);
    }
  });

  // Update the system message to add information about the new tools
  app.get("/api/assistant/update-system-message", async (req: Request, res: Response) => {
    try {
      // Add information about the new tools to the systemMessage in the conversation endpoint
      const systemMessageUpdates = `
You can now also:
1. Update existing events with update_calendar_event
2. Delete events with delete_calendar_event
3. Search calendar events by keywords or date ranges

For updating events, you need the event ID (which you can get from the context or by searching)
For deleting events, you only need the event ID`;

      return res.status(200).json({ success: true, message: "Assistant system message updated" });
    } catch (err) {
      console.error("Error updating assistant system message:", err);
      return handleApiError(err, res);
    }
  });

  // Update the real-time weather data API
  app.get("/api/weather/realtime", async (req: Request, res: Response) => {
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

      const formattedData = formatWeatherData(weatherData);
      return res.status(200).json(formattedData.current);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Update the weather-dependent events endpoint
  app.get("/api/events/weather-dependent", async (req: Request, res: Response) => {
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

      // Get events that depend on weather
      const events = await storage.getEventsByUser(1); // Using default user ID 1
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

  // User File Management Routes
  app.get("/api/files", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const fileType = req.query.fileType as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

      let files;
      if (fileType) {
        files = await storage.getUserFilesByType(userId, fileType);
      } else if (projectId) {
        files = await storage.getUserFilesByProject(projectId);
      } else {
        files = await storage.getUserFilesByUser(userId);
      }

      return res.status(200).json(files);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/files/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getUserFile(id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }

      // Update last accessed timestamp
      await storage.updateUserFile(id, { lastAccessed: new Date() });
      
      return res.status(200).json(file);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/files", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const fileData = { ...req.body, userId };
      
      const validatedFile = insertUserFileSchema.parse(fileData);
      const newFile = await storage.createUserFile(validatedFile);
      
      return res.status(201).json(newFile);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/files/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedFile = await storage.updateUserFile(id, req.body);
      
      if (!updatedFile) {
        return res.status(404).json({ message: "File not found" });
      }
      
      return res.status(200).json(updatedFile);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/files/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUserFile(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "File not found" });
      }
      
      return res.status(200).json({ message: "File deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/files/:id/content", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const file = await storage.getUserFile(id);
      
      if (!file) {
        return res.status(404).json({ message: "File not found" });
      }
      
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
  app.get("/api/documents", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const documentType = req.query.documentType as string;
      const projectId = req.query.projectId ? parseInt(req.query.projectId as string) : undefined;

      let documents;
      if (documentType) {
        documents = await storage.getUserDocumentsByType(userId, documentType);
      } else if (projectId) {
        documents = await storage.getUserDocumentsByProject(projectId);
      } else {
        documents = await storage.getUserDocumentsByUser(userId);
      }

      return res.status(200).json(documents);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const document = await storage.getUserDocument(id);
      
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      return res.status(200).json(document);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.post("/api/documents", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const documentData = { ...req.body, userId };
      
      const validatedDocument = insertUserDocumentSchema.parse(documentData);
      const newDocument = await storage.createUserDocument(validatedDocument);
      
      return res.status(201).json(newDocument);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updatedDocument = await storage.updateUserDocument(id, req.body);
      
      if (!updatedDocument) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      return res.status(200).json(updatedDocument);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/documents/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteUserDocument(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      return res.status(200).json({ message: "Document deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Notification routes
  app.get("/api/notifications", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const notifications = await storage.getNotificationsByUser(userId);
      return res.status(200).json(notifications);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/notifications/unread", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const unreadNotifications = await storage.getUnreadNotificationsByUser(userId);
      return res.status(200).json(unreadNotifications);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/notifications/unread/count", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const unreadNotifications = await storage.getUnreadNotificationsByUser(userId);
      return res.status(200).json({ count: unreadNotifications.length });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.getNotification(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.status(200).json(notification);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/notifications/:id/read", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const notification = await storage.markNotificationAsRead(id);
      
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.status(200).json(notification);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.put("/api/notifications/:id/dismiss", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const dismissed = await storage.dismissNotification(id);
      
      if (!dismissed) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.status(200).json({ message: "Notification dismissed" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/notifications/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteNotification(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      return res.status(200).json({ message: "Notification deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Image routes
  app.get("/api/images", async (req: Request, res: Response) => {
    try {
      const userId = 1; // Default demo user
      const images = await storage.getImagesByUser(userId);
      return res.status(200).json(images);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/images/event/:eventId", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId);
      const images = await storage.getImagesByEvent(eventId);
      return res.status(200).json(images);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/images/conversation/:conversationId", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const images = await storage.getImagesByConversation(conversationId);
      return res.status(200).json(images);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.get("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const image = await storage.getImage(id);
      
      if (!image) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      return res.status(200).json(image);
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  app.delete("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteImage(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Image not found" });
      }
      
      return res.status(200).json({ message: "Image deleted successfully" });
    } catch (err) {
      return handleApiError(err, res);
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}