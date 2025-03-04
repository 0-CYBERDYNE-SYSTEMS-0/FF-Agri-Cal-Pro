import { apiRequest } from "./queryClient";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
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
        },
        ...initialMessages
      ];
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
      return assistantMessage.content;
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
