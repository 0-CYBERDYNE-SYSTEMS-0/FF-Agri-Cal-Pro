import { apiRequest } from "./queryClient";

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    }
  }>;
  tool_call_id?: string;
}

// Send a message to the conversation and get the AI response
// This function communicates with our backend which calls the OpenAI API
export async function getChatCompletion(
  conversationId: number,
  message: string
): Promise<string> {
  try {
    const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
      message
    });
    const data = await response.json();
    
    // Get the last message (which should be the assistant's response)
    const assistantMessage = data.messages[data.messages.length - 1];
    return assistantMessage.content;
  } catch (error) {
    console.error("Error fetching AI response:", error);
    throw error;
  }
}

export async function createConversation(initialMessages: Message[] = []): Promise<number> {
  try {
    // Default system message for agricultural assistance
    if (!initialMessages.some(msg => msg.role === "system")) {
      initialMessages = [
        {
          role: "system",
          content: "You are Farm Friend: Agri-Cal. An agricultural planning assistant specialized in crop management, seasonal planning, and weather-adaptive farming techniques.\n\n" +
          "Current date and time: " + new Date().toLocaleString() + "\n" +
          "You must always consider the current date, time, and user's location in ALL your recommendations and activities. Time-sensitive agricultural advice is crucial for successful farming.\n\n" +
          "Your responsibilities:\n" +
          "1. Provide specific crop planting and harvesting schedules based on seasons and locations\n" +
          "2. Suggest sustainable farming practices appropriate for different crops and climates\n" +
          "3. Help users plan their agricultural calendar with detailed timelines\n" +
          "4. Offer recommendations for dealing with various weather conditions and climate challenges\n" +
          "5. Assist with pest management and soil health optimization\n" +
          "6. Provide advice on water conservation and irrigation planning\n" +
          "7. Create, modify, and manage calendar events for agricultural tasks\n" +
          "8. Help sync weather forecasts with farming activities for optimal planning\n\n" +
          "AVAILABLE TOOLS:\n" +
          "1. Web Search: Use the search_web function to find up-to-date information when needed, especially for specific agricultural data, seasonal information, regional farming practices, or historical agricultural trends.\n" +
          "2. Weather Tool: Use the get_weather function to get real-time weather data and agricultural recommendations for a specific location. This helps provide location-specific advice based on current and forecasted weather conditions.\n" +
          "3. Calendar Management: You can create, update, delete, and search calendar events in ICS format for agricultural tasks. You'll help users schedule their farming activities based on optimal conditions.\n" +
          "4. File Management: You can read user's uploaded files (CSV, documents, farm data) using read_user_file and list their files with list_user_files.\n" +
          "5. Document Management: You can create notes and documents for users with create_user_document and list their existing documents with list_user_documents.\n" +
          "6. Data Analysis: Use analyze_farm_data to analyze user's uploaded farm data files for yield analysis, weather patterns, soil health, and growth tracking.\n" +
          "7. Historical Data Analysis: You can analyze past weather patterns and agricultural data to provide recommendations for current planning.\n\n" +
          "CALENDAR INTEGRATION CAPABILITIES:\n" +
          "- You can detect calendar-related requests in user messages\n" +
          "- You can create events with create_calendar_event\n" +
          "- You can update existing events with update_calendar_event\n" +
          "- You can delete events with delete_calendar_event\n" +
          "- You can search for events with search_calendar_events (by keyword, date range, or project)\n" +
          "- You can recommend optimal scheduling based on weather forecasts\n" +
          "- You understand agricultural seasonality and can plan accordingly\n" +
          "- You can manage farming projects with get_or_create_project\n\n" +
          "FILE & DOCUMENT MANAGEMENT CAPABILITIES:\n" +
          "- You can read user's uploaded files (CSV, spreadsheets, reports) with read_user_file\n" +
          "- You can list all user files or filter by type/project with list_user_files\n" +
          "- You can create notes, plans, and reports for users with create_user_document\n" +
          "- You can list existing documents and filter by type/project with list_user_documents\n" +
          "- You can analyze farm data files for insights with analyze_farm_data\n" +
          "- Supported analysis types: yield_analysis, weather_patterns, soil_health, growth_tracking\n" +
          "- You can help users organize their agricultural data and documentation\n\n" +
          "AGRICULTURAL EXPERTISE:\n" +
          "- You have extensive knowledge of crop cycles, planting times, and harvest periods\n" +
          "- You understand different farming techniques (conventional, organic, regenerative, etc.)\n" +
          "- You can provide pest management strategies appropriate to crop types and seasons\n" +
          "- You're familiar with irrigation systems and water management practices\n" +
          "- You can recommend appropriate tools and equipment for various farming tasks\n" +
          "- You understand soil health management and fertilization schedules\n\n" +
          "IMPORTANT CONTEXTUAL INFORMATION:\n" +
          "- Weather data, location information, and calendar events will be provided in subsequent API calls\n" +
          "- DO NOT assume any specific calendar events exist until you've used search_calendar_events to check\n" +
          "- Always get current weather information with get_weather before making weather-dependent recommendations\n\n" +
          "FORMATTING INSTRUCTIONS:\n" +
          "- Format your responses using Markdown to improve readability\n" +
          "- When suggesting calendar events, clearly mark them with [EVENT] tags\n" +
          "- Format calendar events as: [EVENT] Title: {title}, Date: {date}, Time: {time}, Description: {description}\n" +
          "- For weather-sensitive events, include [WEATHER-DEPENDENT] tag\n" +
          "- Always include reasoning for your recommendations based on agricultural best practices\n\n" +
          "FIRST GREETING INSTRUCTIONS:\n" +
          "- When starting a new conversation, first check the weather and season for the user's location\n" +
          "- Provide a brief weather report and season-appropriate agricultural greeting\n" +
          "- Mention 2-3 relevant seasonal farming activities for their region\n" +
          "- Ask how you can help with their agricultural planning needs\n" +
          "- Do NOT mention any specific crops (like tomatoes) unless the user mentions them first\n\n" +
          "Always be helpful, practical, and knowledgeable. Focus on providing actionable agricultural advice that farmers can implement immediately."
        },
        ...initialMessages
      ];
      
      // Add a default assistant welcome message if none exists
      if (!initialMessages.some(msg => msg.role === "assistant")) {
        initialMessages.push({
          role: "assistant",
          content: "Hello! I'm your agricultural planning assistant. I'll check the current weather and seasonal conditions for your region to provide relevant farming recommendations. How can I help with your agricultural planning today?"
        });
      }
    }
    
    const response = await apiRequest("POST", "/api/conversations", {
      messages: initialMessages
    });
    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Error creating conversation:", error);
    throw error;
  }
}

export async function getConversation(id: number): Promise<Message[]> {
  try {
    const response = await apiRequest("GET", `/api/conversations/${id}`);
    const data = await response.json();
    return data.messages;
  } catch (error) {
    console.error("Error fetching conversation:", error);
    throw error;
  }
}

export async function getAiSuggestion(prompt: string): Promise<string> {
  try {
    // Create a temporary conversation with the prompt
    const conversationId = await createConversation([
      {
        role: "user",
        content: prompt
      }
    ]);
    
    // Get the conversation to retrieve the AI's response
    const messages = await getConversation(conversationId);
    
    // Find the assistant's response (should be the last message)
    const assistantMessage = messages.find(msg => msg.role === "assistant");
    
    if (assistantMessage) {
      // Check for tool_calls in the message (function calls)
      if (assistantMessage.tool_calls) {
        // If there are tool_calls, the message might be a function call response
        // We need to look for the actual text response after function call resolution
        
        // Find the last assistant message with content after tool responses
        const lastContentfulMessage = messages
          .filter(msg => msg.role === "assistant" && msg.content)
          .pop();
        
        if (lastContentfulMessage && lastContentfulMessage.content) {
          return lastContentfulMessage.content;
        }
        
        // If no text response found, return a default response
        return "I've processed your request, but didn't generate a text response. Please try a different prompt.";
      }
      
      // Normal text response
      return assistantMessage.content || "No response content available";
    } else {
      throw new Error("No assistant response found");
    }
  } catch (error) {
    console.error("Error getting AI suggestion:", error);
    
    // Fallback responses in case of API failure
    const fallbackSuggestions: Record<string, string> = {
      tomatoes: "For tomatoes, I suggest planting them in early spring after the last frost. They need at least 6 hours of sunlight daily and regular watering. Consider adding a trellis for support.",
      compost: "Your compost pile should be turned weekly for best results. Keep a good mix of green (nitrogen-rich) and brown (carbon-rich) materials at a ratio of about 1:3.",
      irrigation: "Based on current weather patterns, I recommend setting up your irrigation system to water plants in the early morning (5-7 AM) to minimize evaporation loss. Check soil moisture levels before watering.",
      default: "I can provide planting schedules, crop rotation tips, and weather-based agricultural advice. For specific recommendations, please provide more details about your location and the crops you're working with."
    };
    
    // Simple keyword matching for fallback
    for (const [keyword, suggestion] of Object.entries(fallbackSuggestions)) {
      if (prompt.toLowerCase().includes(keyword)) {
        return suggestion;
      }
    }
    
    return fallbackSuggestions.default;
  }
}
