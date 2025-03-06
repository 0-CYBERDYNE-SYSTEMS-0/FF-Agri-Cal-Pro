import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { formatDate } from "@/lib/calendarUtils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAiSuggestion } from "@/lib/openAiApi";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: Date | null;
  editEventId?: number;
}

export default function EventModal({ isOpen, onClose, selectedDate, editEventId }: EventModalProps) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [checkWeather, setCheckWeather] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState("day");
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      // Initialize form with defaults
      setTitle("");
      setDescription("");
      setLocation("");
      setCheckWeather(false);
      setIsRecurring(false);
      setShowAiSuggestions(false);
      setAiSuggestion("");
      
      // Set default project if available
      if (projects.length > 0) {
        setProjectId(String(projects[0].id));
      }
      
      // Set dates/times based on selectedDate or current time
      const now = selectedDate || new Date();
      const endTime = new Date(now);
      endTime.setHours(endTime.getHours() + 1);
      
      setStartDate(formatDate(now, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').join('-'));
      setStartTime(formatTimeForInput(now));
      
      setEndDate(formatDate(endTime, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').join('-'));
      setEndTime(formatTimeForInput(endTime));
      
      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      setRecurrenceEndDate(formatDate(oneMonthLater, { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').join('-'));
    }
  }, [isOpen, selectedDate, projects]);

  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await apiRequest("POST", "/api/events", eventData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event created",
        description: "The event has been successfully created.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error creating the event. Please try again.",
        variant: "destructive",
      });
      console.error("Error creating event:", error);
    },
  });

  const formatTimeForInput = (date: Date): string => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!title) {
      toast({
        title: "Error",
        description: "Please enter an event title.",
        variant: "destructive",
      });
      return;
    }
    
    // Create start and end date objects
    const start = new Date(`${startDate}T${startTime}`);
    const end = new Date(`${endDate}T${endTime}`);
    
    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      toast({
        title: "Error",
        description: "Please enter valid dates and times.",
        variant: "destructive",
      });
      return;
    }
    
    if (start > end) {
      toast({
        title: "Error",
        description: "End time must be after start time.",
        variant: "destructive",
      });
      return;
    }
    
    // Prepare recurring pattern if needed
    let recurringPattern = null;
    if (isRecurring) {
      const endDate = recurrenceEndDate ? new Date(recurrenceEndDate) : null;
      recurringPattern = {
        frequency: recurrenceType,
        interval: recurrenceInterval,
        endDate: endDate ? endDate.toISOString() : null
      };
    }
    
    // Create event object
    const eventData = {
      title,
      description,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      projectId: projectId ? parseInt(projectId) : null,
      location,
      checkWeather,
      isRecurring,
      recurringPattern
    };
    
    // Submit data
    createEventMutation.mutate(eventData);
  };

  const handleAskAi = async () => {
    try {
      setIsLoadingSuggestion(true);
      setShowAiSuggestions(true);
      
      // Get the selected project's details
      const selectedProject = projects.find(p => p.id === parseInt(projectId));
      
      // Create a more detailed prompt based on the event information
      const prompt = `I'm planning an agricultural project titled "${selectedProject?.name || 'my project'}". ${
        selectedProject?.description ? `Project overview: ${selectedProject.description}. ` : ''
      }${
        title ? `I need to add a specific task: "${title}". ` : 'I need to break this down into specific tasks. '
      }${
        description ? `Task details: ${description}. ` : ''
      }${
        location ? `Location: ${location}. ` : ''
      }Starting date: ${startDate}.
      
      Please provide detailed agricultural planning advice for this task, including:
      1. A brief description of the activity
      2. Recommended timing and duration
      3. Any weather considerations
      4. Best practices for this agricultural activity
      
      Format the response to be easy to read in a calendar event description.`;
      
      const suggestion = await getAiSuggestion(prompt);
      setAiSuggestion(suggestion);
    } catch (error) {
      console.error("Error getting AI suggestion:", error);
      setAiSuggestion("Sorry, I couldn't generate a suggestion at this time.");
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const applyAiSuggestion = () => {
    setDescription(aiSuggestion);
    setShowAiSuggestions(false);
  };
  
  // Function to generate a series of events from an AI plan
  const handleGenerateEventSeries = async () => {
    try {
      setIsLoadingSuggestion(true);
      
      // Get the selected project's details
      const selectedProject = projects.find(p => p.id === parseInt(projectId));
      
      // Create a prompt to generate a series of events
      const prompt = `I need to create a complete calendar for my agricultural project titled "${selectedProject?.name || 'my project'}". ${
        selectedProject?.description ? `Project overview: ${selectedProject.description}. ` : ''
      }
      Starting date: ${startDate}.
      ${selectedProject?.endDate ? `Ending date: ${new Date(selectedProject.endDate).toISOString().split('T')[0]}.` : ''}
      ${location ? `Location: ${location}. ` : ''}
      
      Please generate a detailed timeline of agricultural events that would be part of this project, including:
      1. A title for each task or event
      2. A brief description of each task
      3. When each task should be scheduled (exact date if possible)
      4. Approximate duration for each task
      
      Format your response as a structured JSON array with fields: title, description, suggestedDate, durationHours`;
      
      const suggestion = await getAiSuggestion(prompt);
      
      // Try to parse the JSON from the AI response
      let eventData: any[] = [];
      try {
        // Find the JSON part in the response (it might be wrapped in markdown code blocks)
        const jsonMatch = suggestion.match(/```json\n([\s\S]*?)\n```/) || 
                          suggestion.match(/```\n([\s\S]*?)\n```/) || 
                          suggestion.match(/\[([\s\S]*?)\]/);
        
        const jsonText = jsonMatch ? jsonMatch[1] : suggestion;
        eventData = JSON.parse(jsonText.includes('[') ? jsonText : `[${jsonText}]`);
      } catch (parseError) {
        console.error("Error parsing AI suggestion:", parseError);
        toast({
          title: "Error",
          description: "Could not parse the AI-generated event plan. Please try again or create events manually.",
          variant: "destructive",
        });
        setAiSuggestion(suggestion);
        return;
      }
      
      // Create multiple events based on the AI suggestion
      for (const event of eventData) {
        if (!event.title) continue;
        
        // Calculate start and end times
        let startDateTime = new Date(event.suggestedDate || startDate);
        if (isNaN(startDateTime.getTime())) {
          startDateTime = new Date(startDate);
        }
        
        // Set start time to 9 AM if not specified
        startDateTime.setHours(9, 0, 0, 0);
        
        // Calculate end time based on duration (default to 1 hour)
        const duration = event.durationHours || 1;
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + duration);
        
        // Create the event
        const eventData = {
          title: event.title,
          description: event.description || "",
          startDate: startDateTime.toISOString(),
          endDate: endDateTime.toISOString(),
          projectId: projectId ? parseInt(projectId) : null,
          location: location,
          checkWeather: true,
          isRecurring: false,
          recurringPattern: null
        };
        
        // Submit the event
        try {
          await createEventMutation.mutateAsync(eventData);
        } catch (error) {
          console.error("Error creating event:", error);
        }
      }
      
      toast({
        title: "Events created",
        description: `${eventData.length} events have been added to your calendar.`,
      });
      
      onClose();
    } catch (error) {
      console.error("Error generating event series:", error);
      toast({
        title: "Error",
        description: "There was an error creating events. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-neutral-900">
            {editEventId ? "Edit Event" : "Add New Event"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="event-title">Event Title</Label>
            <Input 
              id="event-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event-date">Start Date</Label>
              <Input 
                type="date" 
                id="event-date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="event-time">Start Time</Label>
              <Input 
                type="time" 
                id="event-time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="event-end-date">End Date</Label>
              <Input 
                type="date" 
                id="event-end-date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="event-end-time">End Time</Label>
              <Input 
                type="time" 
                id="event-end-time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="event-project">Project</Label>
            <Select 
              value={projectId} 
              onValueChange={setProjectId}
            >
              <SelectTrigger className="w-full mt-1">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ Create New Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label htmlFor="event-location">Location</Label>
            <Input 
              id="event-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-1"
              placeholder="e.g. Main Garden, Greenhouse"
            />
          </div>
          
          <div>
            <Label htmlFor="event-description">Description</Label>
            <Textarea 
              id="event-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              rows={3}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="check-weather" 
              checked={checkWeather}
              onCheckedChange={(checked) => setCheckWeather(checked as boolean)}
            />
            <Label htmlFor="check-weather" className="text-sm font-normal">
              Check weather conditions for this task
            </Label>
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="repeating-event" 
              checked={isRecurring}
              onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
            />
            <Label htmlFor="repeating-event" className="text-sm font-normal">
              Make this a repeating event
            </Label>
          </div>
          
          {isRecurring && (
            <div className="pl-6 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral-700">Repeat every</span>
                <Input 
                  type="number" 
                  min="1" 
                  value={recurrenceInterval}
                  onChange={(e) => setRecurrenceInterval(parseInt(e.target.value))}
                  className="w-16"
                />
                <Select 
                  value={recurrenceType} 
                  onValueChange={setRecurrenceType}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">day</SelectItem>
                    <SelectItem value="week">week</SelectItem>
                    <SelectItem value="month">month</SelectItem>
                    <SelectItem value="year">year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-neutral-700">Until</span>
                <Input 
                  type="date" 
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                />
              </div>
            </div>
          )}
          
          {showAiSuggestions && (
            <div className="p-3 bg-neutral-50 rounded-md border border-neutral-200">
              <h4 className="text-sm font-medium mb-2">AI Suggestion:</h4>
              {isLoadingSuggestion ? (
                <div className="text-sm text-neutral-600">Loading suggestion...</div>
              ) : (
                <>
                  <p className="text-sm text-neutral-600 mb-2">{aiSuggestion}</p>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    size="sm"
                    onClick={applyAiSuggestion}
                  >
                    Apply Suggestion
                  </Button>
                </>
              )}
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={handleAskAi}
                disabled={isLoadingSuggestion}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                Task Advice
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1"
                onClick={handleGenerateEventSeries}
                disabled={isLoadingSuggestion || !projectId}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Generate Calendar
              </Button>
            </div>
            
            <Button 
              type="submit" 
              className="bg-primary hover:bg-primary-dark w-full"
              disabled={createEventMutation.isPending}
            >
              {createEventMutation.isPending ? "Creating..." : "Create Event"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
