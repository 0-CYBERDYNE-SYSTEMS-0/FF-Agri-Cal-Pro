import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Conversation } from "@shared/schema";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export default function ChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Get existing conversation or create new one
  const { data: conversations = [], isLoading: isLoadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: isOpen,
  });
  
  // Get active conversation
  const { data: activeConversation, isLoading: isLoadingActiveConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const response = await apiRequest("GET", `/api/conversations/${conversationId}`);
      return response.json();
    },
    enabled: !!conversationId && isOpen
  });
  
  // Create conversation mutation
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
      setConversationId(data.id);
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
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, message }: { conversationId: number, message: string }) => {
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { message });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
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
  
  // Initialize conversation
  useEffect(() => {
    if (isOpen && !isLoadingConversations && !conversationId) {
      if (conversations.length > 0) {
        setConversationId(conversations[0].id);
      } else {
        createConversationMutation.mutate();
      }
    }
  }, [isOpen, isLoadingConversations, conversations, conversationId]);
  
  // Scroll to bottom of messages when new messages are added
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeConversation, isOpen]);
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !conversationId) return;
    
    try {
      await sendMessageMutation.mutateAsync({ conversationId, message: input });
      setInput("");
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };
  
  const messages = activeConversation?.messages || [];

  return (
    <>
      {/* Fixed chat button at the bottom right */}
      <div className="fixed bottom-6 right-6">
        <Button 
          id="chat-button"
          onClick={toggleChat}
          className="flex items-center justify-center h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </Button>
      </div>
      
      {/* Chat popup */}
      <div 
        id="chat-popup" 
        className={`${isOpen ? 'block' : 'hidden'} fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-lg shadow-2xl overflow-hidden z-10 max-h-[70vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-200 bg-primary text-white">
          <h3 className="font-medium">AI Assistant</h3>
          <button 
            id="close-chat" 
            className="text-white hover:text-neutral-200 transition"
            onClick={toggleChat}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4" id="chat-messages">
          {isLoadingActiveConversation ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={index} className={`flex items-start ${
                  message.role === "user" ? "justify-end" : ""
                }`}>
                  {message.role === "assistant" && (
                    <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                      AI
                    </div>
                  )}
                  
                  <div className={`${
                    message.role === "user" 
                      ? "mr-2 bg-primary-light text-white" 
                      : "ml-2 bg-neutral-100"
                  } rounded-lg p-3 max-w-[75%]`}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  
                  {message.role === "user" && (
                    <div className="flex-shrink-0 bg-secondary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                      You
                    </div>
                  )}
                </div>
              ))}
              
              {sendMessageMutation.isPending && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                    AI
                  </div>
                  <div className="ml-2 bg-neutral-100 rounded-lg p-3">
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
        
        <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Type your message..."
              className="flex-1 py-2 px-4 border border-neutral-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sendMessageMutation.isPending || isLoadingActiveConversation || !conversationId}
            />
            <Button 
              type="submit"
              className="p-2 bg-primary text-white rounded-full hover:bg-primary-dark transition"
              disabled={sendMessageMutation.isPending || isLoadingActiveConversation || !conversationId || !input.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
              </svg>
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
