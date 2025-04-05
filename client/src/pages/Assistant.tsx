import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Conversation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import MarkdownRenderer from "@/components/ui/markdown-renderer";
import { useToast } from "@/hooks/use-toast";
import { createConversation, getChatCompletion } from "@/lib/openAiApi";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function Assistant() {
  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get conversations
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });
  
  // Get active conversation
  const { data: activeConversation, isLoading: isLoadingActiveConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      const response = await apiRequest("GET", `/api/conversations/${activeConversationId}`);
      return response.json();
    },
    enabled: !!activeConversationId
  });
  
  // Mutation for sending messages
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: number, message: string }) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { message });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
      console.error("Error sending message:", error);
    }
  });
  
  // Start a new conversation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/conversations", {
        messages: [
          {
            role: "assistant",
            content: "Hello! I'm your agricultural planning assistant. How can I help you today?"
          }
        ]
      });
      return response.json();
    },
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create a new conversation. Please try again.",
        variant: "destructive"
      });
      console.error("Error creating conversation:", error);
    }
  });
  
  // Initialize by setting the first conversation as active or creating one if none exist
  useEffect(() => {
    if (!isLoadingConversations && !activeConversationId) {
      if (conversations.length > 0) {
        setActiveConversationId(conversations[0].id);
      } else {
        createConversationMutation.mutate();
      }
    }
  }, [isLoadingConversations, conversations, activeConversationId]);
  
  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !activeConversationId) return;
    
    setIsLoadingResponse(true);
    try {
      await sendMessageMutation.mutateAsync({ conversationId: activeConversationId, message: input });
      setInput("");
    } finally {
      setIsLoadingResponse(false);
    }
  };
  
  const handleNewConversation = () => {
    createConversationMutation.mutate();
  };
  
  const handleSelectConversation = (id: number) => {
    setActiveConversationId(id);
  };
  
  // Ensure messages has the correct type (array of Message objects)
  const messages: Message[] = activeConversation?.messages as Message[] || [];

  return (
    <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-14rem)]">
      {/* Sidebar with conversation history */}
      <div className="w-full md:w-64 bg-white rounded-lg shadow p-4 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-medium text-neutral-900">Conversations</h2>
          <Button 
            onClick={handleNewConversation}
            variant="outline"
            size="sm"
            className="text-primary border-primary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New
          </Button>
        </div>
        
        {isLoadingConversations ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : conversations.length > 0 ? (
          <div className="space-y-2">
            {conversations.map((conversation: Conversation) => {
              // Get first message as title or use timestamp
              const messages = conversation.messages as Message[];
              const firstMessage = messages[0]?.content || "";
              const preview = firstMessage.length > 25 
                ? firstMessage.substring(0, 25) + "..." 
                : firstMessage;
              const date = new Date(conversation.createdAt).toLocaleDateString();
              
              return (
                <div 
                  key={conversation.id}
                  className={`p-2 rounded text-sm cursor-pointer ${
                    activeConversationId === conversation.id 
                      ? "bg-primary text-white" 
                      : "bg-neutral-100 hover:bg-neutral-200"
                  }`}
                  onClick={() => handleSelectConversation(conversation.id)}
                >
                  <div className="font-medium">{preview}</div>
                  <div className="text-xs opacity-80">{date}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-neutral-500">
            <p>No conversations yet.</p>
          </div>
        )}
      </div>
      
      {/* Chat interface */}
      <div className="flex-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
        <div className="p-4 border-b border-neutral-200 bg-primary text-white">
          <h2 className="font-medium">Farm Friend</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {isLoadingActiveConversation ? (
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                  AI
                </div>
                <Skeleton className="ml-2 h-20 w-3/4" />
              </div>
              <div className="flex items-start justify-end">
                <Skeleton className="mr-2 h-10 w-2/4" />
                <div className="flex-shrink-0 bg-secondary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                  You
                </div>
              </div>
            </div>
          ) : (
            <>
              {messages
                // Filter out system messages so they don't show in the UI
                .filter((message: Message) => message.role !== "system")
                .map((message: Message, index: number) => (
                <div key={index} className={`flex items-start ${
                  message.role === "user" ? "justify-end" : ""
                }`}>
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                      AI
                    </div>
                  )}
                  
                  <div className={`mx-2 rounded-lg p-3 max-w-[75%] shadow-sm ${
                    message.role === "user" 
                      ? "bg-primary text-white" 
                      : "bg-white border border-gray-200"
                  }`}>
                    {message.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <MarkdownRenderer 
                        content={message.content} 
                        className={`text-sm ${message.role === "assistant" ? "text-neutral-800" : "text-white"}`}
                      />
                    )}
                  </div>
                  
                  {message.role === "user" && (
                    <div className="flex-shrink-0 bg-secondary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                      You
                    </div>
                  )}
                </div>
              ))}
              
              {isLoadingResponse && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                    AI
                  </div>
                  <div className="ml-2 bg-white rounded-lg p-3 shadow-sm border border-gray-200">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-75"></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce delay-150"></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 bg-white">
          <div className="flex space-x-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message... (Markdown supported)"
              className="flex-1 py-2 px-4 border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              disabled={isLoadingResponse || isLoadingActiveConversation || !activeConversationId}
            />
            <Button 
              type="submit"
              className="p-2 bg-primary text-white rounded-full hover:bg-primary-dark transition"
              disabled={isLoadingResponse || isLoadingActiveConversation || !activeConversationId || !input.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
