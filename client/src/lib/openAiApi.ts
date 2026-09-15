import { apiRequest } from "./queryClient";
import { Conversation } from "@shared/schema";
import type { QueryClient } from "@tanstack/react-query";

export type AdviceMode = "general" | "local";

export interface ChatMessageRequest {
  message: string;
  adviceMode: AdviceMode;
  location: string | null;
  timeZone: string;
}

// A saved write performed by an assistant tool during the message turn
export interface ChatMutation {
  type: string;
  id: number;
  ok: boolean;
}

export interface ChatResponse {
  conversation: Conversation;
  mutations: ChatMutation[];
}

export function getTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export async function createConversation(greeting: string): Promise<Conversation> {
  const response = await apiRequest("POST", "/api/conversations", {
    messages: [
      {
        role: "assistant",
        content: greeting
      }
    ]
  });
  return response.json();
}

export async function sendChatMessage(
  conversationId: number,
  request: ChatMessageRequest
): Promise<ChatResponse> {
  const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
    message: request.message,
    adviceMode: request.adviceMode,
    location: request.location,
    timeZone: request.timeZone
  });
  return response.json();
}

// Invalidates the queries affected by a chat turn's saved mutations so both
// chat surfaces refresh events, projects, and documents from the results.
export function invalidateMutatedQueries(queryClient: QueryClient, data: ChatResponse): void {
  const mutations = data.mutations ?? [];
  if (mutations.some(m => m.type.endsWith("_event"))) {
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  }
  if (mutations.some(m => m.type === "create_project")) {
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  }
  if (mutations.some(m => m.type === "create_document")) {
    queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
  }
  if (mutations.some(m => m.type === "create_plan")) {
    queryClient.invalidateQueries({ queryKey: ["/api/plans"] });
  }
}

export async function getAiSuggestion(prompt: string): Promise<string> {
  const conversation = await createConversation("");
  const updated = await sendChatMessage(conversation.id, {
    message: prompt,
    adviceMode: "general",
    location: null,
    timeZone: getTimeZone()
  });

  const messages = (updated.conversation.messages as Array<{ role: string; content: string | null }>) || [];
  const lastAssistant = [...messages]
    .reverse()
    .find(msg => msg.role === "assistant" && msg.content);

  if (!lastAssistant || !lastAssistant.content) {
    throw new Error("No assistant response found");
  }

  return lastAssistant.content;
}
