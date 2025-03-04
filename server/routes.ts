import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertProjectSchema, insertEventSchema, insertConversationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

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
      const eventData = insertEventSchema.parse({ ...req.body, userId });
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
      // Mock location data - in a real app, this would come from the user's location
      const location = (req.query.location as string) || "default";
      const forecast = await storage.getMockWeatherForecast(location);
      return res.status(200).json(forecast);
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
      const conversationData = insertConversationSchema.parse({ ...req.body, userId });
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
      
      // Make sure there's a system message defining the assistant's role
      if (!updatedMessages.some(msg => msg.role === "system")) {
        updatedMessages.unshift({
          role: "system",
          content: `You are an agricultural planning assistant specialized in crop management, seasonal planning, and weather-adaptive farming techniques.
          
Current date: ${new Date().toLocaleDateString()}
          
Your responsibilities:
1. Provide specific crop planting and harvesting schedules based on seasons and locations
2. Suggest sustainable farming practices appropriate for different crops and climates
3. Help users plan their agricultural calendar with detailed timelines
4. Offer recommendations for dealing with various weather conditions and climate challenges
5. Assist with pest management and soil health optimization
6. Provide advice on water conservation and irrigation planning

Respond with detailed, actionable information that farmers can implement immediately. Include specific timelines, measurements, and practical steps whenever possible.`
        });
      }
      
      // Convert messages to the format expected by OpenAI
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Call OpenAI API with model fallback
      let response;
      try {
        // First attempt with o3-mini model
        response = await openai.chat.completions.create({
          model: "o3-mini",
          messages: apiMessages,
          reasoning_effort: "high", // New parameter for o3-mini: low, medium, or high
          temperature: 0.7,
          max_tokens: 500
        });
      } catch (modelError) {
        console.warn("o3-mini model error, falling back to gpt-4o:", modelError.message);
        try {
          // Fallback to gpt-4o
          response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500
          });
        } catch (fallbackError) {
          console.warn("gpt-4o model error, falling back to gpt-3.5-turbo:", fallbackError.message);
          // Final fallback to gpt-3.5-turbo
          response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: apiMessages,
            temperature: 0.7,
            max_tokens: 500
          });
        }
      }
      
      // Get AI response
      const aiResponse = response.choices[0].message.content || "I'm sorry, I couldn't process your request.";
      
      // Add AI response to conversation
      updatedMessages.push({ role: "assistant", content: aiResponse });
      
      const updatedConversation = await storage.updateConversation(id, updatedMessages);
      return res.status(200).json(updatedConversation);
    } catch (err) {
      console.error("OpenAI API Error:", err);
      return handleApiError(err, res);
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
