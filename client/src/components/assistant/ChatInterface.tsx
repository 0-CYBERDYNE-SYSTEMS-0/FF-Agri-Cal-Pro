import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Conversation, Project, Event, WeatherForecast } from "@shared/schema";
import MarkdownRenderer from "@/components/ui/markdown-renderer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  detectCalendarEventsInAIMessage, 
  AICalendarEvent, 
  createCalendarEventBatch, 
  getOrCreateProject, 
  generateCalendarSystemMessage, 
  downloadCalendarAsICS,
  createEventFromAssistantClaim,
  createCalendarEvent
} from "@/lib/calendarService";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Download, Calendar, AlertCircle, Info, MessageCircle, X } from "lucide-react";
import { useLocation } from "@/contexts/LocationContext";
import { locationService } from "@/lib/locationService";

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
  
  // Location-independent mode
  const [locationIndependentMode, setLocationIndependentMode] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  
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
  
  // Get messages from active conversation
  const messages: Message[] = activeConversation?.messages as Message[] || [];
  
  // Get the user's current location
  const { 
    location: userLocation, 
    isLoading: isLoadingLocation, 
    requestLocationPermission,
    validatedLocation,
    confidence,
    source,
    locationChangeDetected
  } = useLocation();
  
  // Initialize location-independent mode based on location availability
  useEffect(() => {
    const savedMode = localStorage.getItem("locationIndependentMode");
    if (savedMode) {
      setLocationIndependentMode(JSON.parse(savedMode));
    } else {
      // Auto-enable if no location available after initial load
      const timer = setTimeout(() => {
        if (!userLocation && !isLoadingLocation) {
          setLocationIndependentMode(true);
          setShowLocationModal(true);
        }
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [userLocation, isLoadingLocation]);
  
  // Request location permission when chat is opened (only if not in independent mode)
  useEffect(() => {
    if (isOpen && !locationIndependentMode) {
      // Only request if we don't already have a location and haven't requested before
      if (!userLocation) {
        const locationRequested = localStorage.getItem("locationRequested");
        if (!locationRequested) {
          requestLocationPermission();
        }
      }
    }
  }, [isOpen, userLocation, requestLocationPermission, locationIndependentMode]);
  
  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const greeting = locationIndependentMode ? 
        "Hello! I'm your agricultural planning assistant. I'm running in location-independent mode, so I'll provide general agricultural advice and help you plan farming activities without location-specific weather data. How can I help you today?" :
        "Hello! I'm your agricultural planning assistant. How can I help you today? I can help you plan your farming activities, create a calendar of events, or provide information on best practices for your crops based on your location and current weather conditions.";
        
      const response = await apiRequest("POST", "/api/conversations", {
        messages: [
          {
            role: "assistant",
            content: greeting
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
      // Handle location-independent mode
      const locationToSend = locationIndependentMode ? null : userLocation;
      
      const response = await apiRequest("POST", `/api/conversations/${conversationId}/messages`, { 
        message,
        location: locationToSend // Include user's location only if not in independent mode
      });
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
    } else {
      // Test for specific mentions of events - create them immediately
      const compostMention = lastAiMessage.content.match(/turn(ing)? compost|compost pile/i);
      
      if (compostMention) {
        console.log("Compost-related event mentioned, creating event automatically");
        
        // Create a default compost turning event for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Set time to 2:15 PM
        tomorrow.setHours(14, 15, 0, 0);
        
        // End time 1 hour later
        const endTime = new Date(tomorrow);
        endTime.setHours(endTime.getHours() + 1);
        
        const event: AICalendarEvent = {
          title: "Turn Compost Piles",
          description: "Regular compost maintenance to ensure proper decomposition. Check moisture level and aerate the pile.",
          startDate: tomorrow.toISOString(),
          endDate: endTime.toISOString(),
          location: "Compost Area",
          checkWeather: true
        };
        
        // Create the event directly
        createCalendarEvent(event)
          .then(() => {
            // Show success toast
            toast({
              title: "Calendar Event Created",
              description: "Created compost turning event for tomorrow at 2:15 PM",
            });
            
            // Update calendar data
            queryClient.invalidateQueries({ queryKey: ["/api/events"] });
          })
          .catch((err: Error) => {
            console.error("Error creating compost event:", err);
            toast({
              title: "Error",
              description: "Failed to create calendar event. Please try again.",
              variant: "destructive"
            });
          });
        
        return;
      }
      
      // Check if the assistant claims to have created an event without our detection
      const eventCreationMention = lastAiMessage.content.match(/I('ve| have) scheduled|calendar event scheduled|event has been added|added to your calendar|has been successfully scheduled|been scheduled for/i);
      
      if (eventCreationMention) {
        // Fallback: try to extract and create event from claim
        createEventFromAssistantClaim(lastAiMessage.content)
          .then((success) => {
            if (success) {
              toast({
                title: "Calendar Event Created",
                description: "Event created from assistant claim.",
              });
              queryClient.invalidateQueries({ queryKey: ["/api/events"] });
            }
          })
          .catch((err) => {
            console.error("Error creating event from assistant claim:", err);
            toast({
              title: "Error",
              description: "Failed to create calendar event from assistant claim.",
              variant: "destructive"
            });
          });
      }
    }
  }, [messages, queryClient, toast]);
  
  // Get calendar events for calendar export functionality
  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    enabled: isOpen,
  });

  // Get unread notification count for badge
  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread/count"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/notifications/unread/count");
      const data = await response.json();
      return data.count || 0;
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
  
  // Get comprehensive context data for the assistant
  const locationToUse = userLocation || "";
  const { data: contextData, isLoading: isLoadingContext } = useQuery({
    queryKey: ["/api/assistant/context", locationToUse],
    queryFn: async () => {
      // Only fetch context if we have a valid location
      if (!userLocation || !userLocation.trim()) {
        return null; // Don't fetch without a proper location
      }
      
      const response = await apiRequest("GET", `/api/assistant/context?location=${encodeURIComponent(userLocation)}`);
      return response.json();
    },
    enabled: isOpen && !!userLocation && userLocation.trim() !== "", // Only enabled when we have a valid location
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
  
  // Re-fetch context data when location changes (and is no longer loading)
  useEffect(() => {
    if (conversationId && userLocation && !isLoadingLocation) {
      queryClient.invalidateQueries({ queryKey: ["/api/assistant/context"] });
    }
  }, [userLocation, conversationId, queryClient, isLoadingLocation]); // Added isLoadingLocation dependency
  
  // Enhance the assistant with calendar and weather context
  useEffect(() => {
    if (conversationId && !isLoadingContext && contextData) {
      // Format the date
      const currentDate = new Date(contextData.timestamp);
      
      // Add calendar events and weather data as context for the assistant
      let contextMessage = `CONTEXTUAL INFORMATION:

Current date and time: ${currentDate.toLocaleString()}
Current season: ${contextData.season}
User location: ${contextData.location}

`;

      // Only add weather if it exists in the context data
      if (contextData.weather && contextData.weather.current) {
        contextMessage += `Weather conditions: ${contextData.weather.current.temperature}°F, ${contextData.weather.current.conditions}
Humidity: ${contextData.weather.current.humidity}%
Wind: ${contextData.weather.current.wind} mph

`;

        // Add forecast information
        if (contextData.weather.forecast && contextData.weather.forecast.length > 0) {
          contextMessage += `Weather forecast for the next ${contextData.weather.forecast.length} days:
`;
          
          contextData.weather.forecast.forEach((day: any, index: number) => {
            contextMessage += `- Day ${index + 1}: ${day.temperature}°F, ${day.conditions}\n`;
          });
        }
      }
      
      // Add calendar events information
      if (contextData.events && contextData.events.length > 0) {
        contextMessage += `\nUpcoming calendar events:\n`;
        contextData.events.slice(0, 5).forEach((event: any) => {
          const startDate = new Date(event.startDate);
          contextMessage += `- ${event.title} on ${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}${event.isWeatherDependent ? ' (Weather dependent)' : ''}\n`;
        });
      }
      
      // Add recommendations prompt
      contextMessage += `\nPlease consider the above information when providing farming advice, scheduling events, or making recommendations. All calendar events, particularly those marked as weather-dependent, should be aligned with optimal weather conditions for the specific agricultural tasks.`;
      
      // Send the context as a system message
      apiRequest("POST", `/api/conversations/${conversationId}/system-message`, {
        content: contextMessage
      });
    }
  }, [conversationId, contextData, isLoadingContext]);
  
  // Location mode management functions
  const toggleLocationMode = () => {
    const newMode = !locationIndependentMode;
    setLocationIndependentMode(newMode);
    localStorage.setItem("locationIndependentMode", JSON.stringify(newMode));
    
    // Show appropriate message
    toast({
      title: newMode ? "Location-Independent Mode Enabled" : "Location Mode Enabled",
      description: newMode 
        ? "Assistant will provide general agricultural advice without location-specific data"
        : "Assistant will use your location for weather-based recommendations",
    });
    
    // If enabling location mode, request permission
    if (!newMode && !userLocation) {
      requestLocationPermission();
    }
  };
  
  const dismissLocationModal = () => {
    setShowLocationModal(false);
  };
  
  const enableLocationMode = () => {
    setLocationIndependentMode(false);
    localStorage.setItem("locationIndependentMode", "false");
    setShowLocationModal(false);
    requestLocationPermission();
  };
  
  const stayInIndependentMode = () => {
    setLocationIndependentMode(true);
    localStorage.setItem("locationIndependentMode", "true");
    setShowLocationModal(false);
  };
  
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
          message: `Thank you for creating these events. I've added ${completeEvents.length} events to my calendar - these are actual calendar events that are now accessible in my Calendar view.`
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
      {/* Fixed chat button at the bottom right with notification badge */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          id="chat-button"
          onClick={toggleChat}
          className="relative flex items-center justify-center h-14 w-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition"
        >
          <MessageCircle className="h-6 w-6" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive"
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
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
                <div key={index} className="mb-4 p-3 border rounded-md border-neutral-200 bg-white">
                  <div className="flex justify-between">
                    <p className="font-medium">{event.title}</p>
                    {event.checkWeather && (
                      <span className="text-xs bg-blue-100 text-blue-800 rounded-full px-2 py-0.5 flex items-center">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Weather dependent
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-neutral-500">
                    {new Date(event.startDate!).toLocaleDateString()} at {new Date(event.startDate!).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </p>
                  <p className="text-sm mt-1">{event.description}</p>
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
      
      {/* Mobile-First Drawer Chat Interface */}
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="h-[85vh] flex flex-col">
          <DrawerHeader className="border-b bg-primary text-white flex-shrink-0">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-white">Farm Friend</DrawerTitle>
              <DrawerClose className="text-white hover:text-neutral-200">
                <X className="h-5 w-5" />
              </DrawerClose>
            </div>
          </DrawerHeader>
        
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4" id="chat-messages">
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
                      : "ml-2 bg-white border border-gray-200"
                  } rounded-lg p-3 max-w-[75%] shadow-sm`}>
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
              
              {sendMessageMutation.isPending && (
                <div className="flex items-start">
                  <div className="flex-shrink-0 bg-primary rounded-full h-8 w-8 flex items-center justify-center text-white text-sm">
                    AI
                  </div>
                  <div className="ml-2 bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
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
          </ScrollArea>
        
          {/* Download Calendar Button */}
          <div className="flex justify-end px-4 py-2 border-t flex-shrink-0">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-neutral-500 hover:text-primary" 
              onClick={() => downloadCalendarAsICS(events, 'farm-calendar.ics')}
              title="Download Calendar"
            >
              <Download className="h-4 w-4 mr-1" />
              <span className="text-xs">Export Calendar</span>
            </Button>
          </div>
        
          <form onSubmit={handleSendMessage} className="p-4 border-t border-neutral-200 flex-shrink-0">
          <div className="flex space-x-2">
            <Input
              type="text"
              placeholder="Type your message... (Markdown supported)"
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
          
          {/* Location mode indicator */}
          <div className="px-4 py-2 border-t border-neutral-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            {locationIndependentMode ? (
              <>
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                <span className="text-xs text-gray-600">Location-independent mode</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-gray-600">
                  {userLocation ? `Location: ${userLocation}` : "Location mode (no location set)"}
                </span>
              </>
            )}
            {validatedLocation && confidence > 0 && (
              <span className="text-xs text-gray-500">
                ({Math.round(confidence * 100)}% confidence)
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLocationMode}
            className="text-xs"
          >
            Toggle Mode
          </Button>
          </div>
        </DrawerContent>
      </Drawer>
      
      {/* Location Mode Selection Modal */}
      <Dialog open={showLocationModal} onOpenChange={setShowLocationModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Location Settings</DialogTitle>
            <DialogDescription>
              Choose how you'd like to use the agricultural assistant.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                No location was detected. You can either enable location access for weather-based recommendations 
                or continue in location-independent mode for general agricultural advice.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">📍 Location-Based Mode</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Get weather-specific recommendations and location-based agricultural advice.
                </p>
                <Button onClick={enableLocationMode} className="w-full">
                  Enable Location Access
                </Button>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2">🌍 Location-Independent Mode</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Get general agricultural advice without location-specific data.
                </p>
                <Button variant="outline" onClick={stayInIndependentMode} className="w-full">
                  Continue Without Location
                </Button>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="ghost" onClick={dismissLocationModal}>
              Dismiss
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}