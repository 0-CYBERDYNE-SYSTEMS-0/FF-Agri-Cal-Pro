import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertProjectSchema, insertEventSchema, insertConversationSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { searchWeb } from "./perplexityApi";
import { getWeatherInfo, getAgricultureRecommendations } from "./openWeatherApi";

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
  
  // Real-time weather data API for the AI assistant
  app.get("/api/weather-data", async (req: Request, res: Response) => {
    try {
      const location = (req.query.location as string);
      
      if (!location) {
        return res.status(400).json({ message: "Location parameter is required" });
      }
      
      const weatherData = await getWeatherInfo(location);
      
      if (!weatherData) {
        return res.status(404).json({ message: "Could not retrieve weather data for this location" });
      }
      
      return res.status(200).json(weatherData);
    } catch (err) {
      return handleApiError(err, res);
    }
  });
  
  // Agricultural weather recommendations API
  app.get("/api/agri-weather-recommendations", async (req: Request, res: Response) => {
    try {
      const location = (req.query.location as string);
      
      if (!location) {
        return res.status(400).json({ message: "Location parameter is required" });
      }
      
      const weatherData = await getWeatherInfo(location);
      
      if (!weatherData) {
        return res.status(404).json({ message: "Could not retrieve weather data for this location" });
      }
      
      const recommendations = getAgricultureRecommendations(weatherData);
      return res.status(200).json({ recommendations });
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
          content: "You are Farm Friend: Agri-Cal. An agricultural planning assistant specialized in crop management, seasonal planning, and weather-adaptive farming techniques.\n\n" +
          "Current date and time: " + new Date().toLocaleString() + "\n" +
          "You must always consider date, time, and location in ALL your recommendations and activities. Time-sensitive agricultural advice is crucial for successful farming.\n\n" +
          "Your responsibilities:\n" +
          "1. Provide specific crop planting and harvesting schedules based on seasons and locations\n" +
          "2. Suggest sustainable farming practices appropriate for different crops and climates\n" +
          "3. Help users plan their agricultural calendar with detailed timelines\n" +
          "4. Offer recommendations for dealing with various weather conditions and climate challenges\n" +
          "5. Assist with pest management and soil health optimization\n" +
          "6. Provide advice on water conservation and irrigation planning\n\n" +
          "AVAILABLE TOOLS:\n" +
          "1. Web Search: Use the search_web function to find up-to-date information when needed, especially for specific agricultural data, seasonal information, or regional farming practices.\n" +
          "2. Weather Tool: Use the get_weather function to get real-time weather data and agricultural recommendations for a specific location. This helps provide location-specific advice based on current and forecasted weather conditions.\n\n" +
          "FORMATTING INSTRUCTIONS:\n" +
          "- Format your responses using Markdown to improve readability\n" +
          "- Use headers (## and ###) to organize information\n" +
          "- Use bullet points or numbered lists for steps and recommendations\n" +
          "- Use bold or italic for emphasis on important points\n" +
          "- Format tables when presenting comparative data\n" +
          "- Use code blocks for representing schedules or technical instructions\n" +
          "- Include emojis where appropriate to make content more engaging\n\n" +
          "Respond with detailed, actionable information that farmers can implement immediately. Include specific timelines, measurements, and practical steps whenever possible."
        });
      }
      
      // Convert messages to the format expected by OpenAI
      const apiMessages = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
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
            model: "gpt-4o",
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
            model: "gpt-3.5-turbo",
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
          const weatherData = await getWeatherInfo(location);
          
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
        }
        
        // Add the tool response to messages array
        (apiMessages as any).push({
          role: "tool",
          content: toolResponse,
          tool_call_id: toolCall.id
        });
        
        // Get a second response from the model with the tool results
        const secondResponse = await openai.chat.completions.create({
          model: "gpt-4o", // Use gpt-4o for handling tool results (more reliable)
          messages: apiMessages,
          temperature: 0.7,
          max_tokens: 800
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

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
