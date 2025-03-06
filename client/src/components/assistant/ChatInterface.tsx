import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Conversation, Project } from "@shared/schema";
import MarkdownRenderer from "@/components/ui/markdown-renderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { detectCalendarEventsInAIMessage, AICalendarEvent, createCalendarEventBatch, getOrCreateProject } from "@/lib/calendarService";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
  
  // Calendar event processing state
  const [detectedEvents, setDetectedEvents] = useState<Partial<AICalendarEvent>[]>([]);
  const [showEventConfirmDialog, setShowEventConfirmDialog] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isProcessingEvents, setIsProcessingEvents] = useState(false);
  const [eventProjectName, setEventProjectName] = useState("");
  
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
  
  const messages: Message[] = activeConversation?.messages as Message[] || [];
  
  // Detect calendar events in AI responses
  useEffect(() => {
    if (!messages.length) return;
    
    // Find the last AI message
    const lastAiMessageIndex = [...messages].reverse().findIndex(msg => msg.role === "assistant");
    if (lastAiMessageIndex === -1) return;
    
    const lastAiMessage = [...messages].reverse()[lastAiMessageIndex];
    
    // Check if the message contains potential calendar events
    const detectedEventsInMessage = detectCalendarEventsInAIMessage(lastAiMessage.content);
    
    if (detectedEventsInMessage.length > 0) {
      // Set detected events and show dialog
      setDetectedEvents(detectedEventsInMessage);
      
      // Try to extract project name from the conversation
      const projectNameMatch = lastAiMessage.content.match(/project(?:\s+called|\s+titled|\s+named)?\s+["']([^"']+)["']/i);
      if (projectNameMatch && projectNameMatch[1]) {
        setEventProjectName(projectNameMatch[1]);
      } else {
        // Default project name
        setEventProjectName("Agricultural Project");
      }
      
      setShowEventConfirmDialog(true);
    }
  }, [messages]);
  
  const toggleChat = () => {
    setIsOpen(!isOpen);
  };
  
  // Handle creating events from AI suggestion
  const handleCreateEvents = async () => {
    if (detectedEvents.length === 0) return;
    
    setIsProcessingEvents(true);
    
    try {
      // Fill in missing data in events
      const completeEvents: AICalendarEvent[] = [];
      
      // Create or get project first
      const project = await getOrCreateProject(
        eventProjectName,
        "Created from AI assistant conversation"
      );
      
      // Default date if none provided
      const defaultDate = new Date();
      defaultDate.setHours(9, 0, 0, 0); // 9 AM
      
      const defaultEndDate = new Date(defaultDate);
      defaultEndDate.setHours(defaultEndDate.getHours() + 1); // 1 hour later
      
      // Process each event
      for (const event of detectedEvents) {
        // Fill in missing required fields
        const completeEvent: AICalendarEvent = {
          title: event.title || "Agricultural Task",
          description: event.description || "",
          startDate: event.startDate || defaultDate.toISOString(),
          endDate: event.endDate || defaultEndDate.toISOString(),
          projectId: project.id,
          location: event.location || "",
          checkWeather: true
        };
        
        completeEvents.push(completeEvent);
      }
      
      // Create all events
      await createCalendarEventBatch(completeEvents);
      
      // Show success message
      toast({
        title: "Events Created",
        description: `Successfully added ${completeEvents.length} events to your calendar.`,
      });
      
      // Update calendar data
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      
      // Close dialog
      setShowEventConfirmDialog(false);
      setDetectedEvents([]);
      
      // Add confirmation message to the conversation
      if (conversationId) {
        await sendMessageMutation.mutateAsync({
          conversationId,
          message: `Thank you for creating these events. I've added ${completeEvents.length} events to my calendar.`
        });
      }
    } catch (error) {
      console.error("Error creating events:", error);
      toast({
        title: "Error",
        description: "There was a problem creating events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingEvents(false);
    }
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
      
      {/* Calendar Event Confirmation Dialog */}
      <Dialog open={showEventConfirmDialog} onOpenChange={setShowEventConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Calendar Events</DialogTitle>
            <DialogDescription>
              I found some potential events in our conversation. Would you like me to add these to your calendar?
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Alert className="mb-4">
              <AlertTitle>Project: {eventProjectName}</AlertTitle>
              <AlertDescription>
                Events will be added to this project. {detectedEvents.length} events detected.
              </AlertDescription>
            </Alert>
            
            <div className="max-h-[200px] overflow-y-auto space-y-2">
              {detectedEvents.map((event, index) => (
                <div key={index} className="p-3 bg-neutral-50 border border-neutral-200 rounded">
                  <h4 className="font-medium">{event.title || "Untitled Event"}</h4>
                  {event.startDate && (
                    <p className="text-sm text-neutral-500">
                      {new Date(event.startDate).toLocaleDateString()} 
                      {event.endDate && ` to ${new Date(event.endDate).toLocaleDateString()}`}
                    </p>
                  )}
                  {event.description && (
                    <p className="text-sm text-neutral-700 line-clamp-2">{event.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowEventConfirmDialog(false)}
              disabled={isProcessingEvents}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateEvents}
              disabled={isProcessingEvents}
            >
              {isProcessingEvents ? (
                <>
                  <span className="mr-2">Creating Events...</span>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </>
              ) : (
                "Add to Calendar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Chat popup */}
      <div 
        id="chat-popup" 
        className={`${isOpen ? 'block' : 'hidden'} fixed bottom-24 right-6 w-80 md:w-96 bg-white rounded-lg shadow-2xl overflow-hidden z-10 max-h-[70vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-neutral-200 bg-primary text-white">
          <h3 className="font-medium">Farm Friend</h3>
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
              {messages.map((message: Message, index: number) => (
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
                      ? "mr-2 bg-primary text-white" 
                      : "ml-2 bg-neutral-100"
                  } rounded-lg p-3 max-w-[75%]`}>
                    {message.role === "user" ? (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <MarkdownRenderer 
                        content={message.content} 
                        className="text-sm text-foreground"
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
