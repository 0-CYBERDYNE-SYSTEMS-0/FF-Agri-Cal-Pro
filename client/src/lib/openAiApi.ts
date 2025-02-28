import { apiRequest } from "./queryClient";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// For demo purposes, we're using a mock API
// In a real application, this would make calls to OpenAI API
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
          content: `You are an agricultural planning assistant. Help the user with their agricultural calendar, planning, and provide advice based on their location and weather conditions. Current date is ${new Date().toLocaleDateString()}.`
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
  // This is a mock function for demo purposes
  // In a real app, this would send the prompt to OpenAI and return the response
  
  const suggestions: Record<string, string> = {
    tomatoes: "For tomatoes, I suggest planting them in early spring after the last frost. They need at least 6 hours of sunlight daily and regular watering. Consider adding a trellis for support.",
    compost: "Your compost pile should be turned weekly for best results. Keep a good mix of green (nitrogen-rich) and brown (carbon-rich) materials at a ratio of about 1:3.",
    irrigation: "Based on current weather patterns, I recommend setting up your irrigation system to water plants in the early morning (5-7 AM) to minimize evaporation loss. Check soil moisture levels before watering.",
    default: "I can provide planting schedules, crop rotation tips, and weather-based agricultural advice. For specific recommendations, please provide more details about your location and the crops you're working with."
  };
  
  // Simple keyword matching
  for (const [keyword, suggestion] of Object.entries(suggestions)) {
    if (prompt.toLowerCase().includes(keyword)) {
      return suggestion;
    }
  }
  
  return suggestions.default;
}
