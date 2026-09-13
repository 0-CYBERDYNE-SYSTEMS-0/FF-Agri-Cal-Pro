import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getAiSuggestion } from "@/lib/openAiApi";
import { getProjectColor } from "@/lib/colorUtils";
import { useAuth } from "@/contexts/AuthContext";
import MarkdownRenderer from "@/components/ui/markdown-renderer";

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
  const { user } = useAuth();

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user && isOpen,
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
      
      setStartDate(format(now, "yyyy-MM-dd"));
      setStartTime(format(now, "HH:mm"));

      setEndDate(format(endTime, "yyyy-MM-dd"));
      setEndTime(format(endTime, "HH:mm"));

      const oneMonthLater = new Date(now);
      oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
      setRecurrenceEndDate(format(oneMonthLater, "yyyy-MM-dd"));
    }
  }, [isOpen, selectedDate, projects]);

  // Add useEffect to load event data when editEventId is provided
  useEffect(() => {
    // Only fetch if we have an event ID and the modal is open
    if (editEventId && isOpen) {
      const fetchEvent = async () => {
        try {
          const response = await apiRequest("GET", `/api/events/${editEventId}`);
          if (!response.ok) {
            throw new Error("Failed to fetch event");
          }
          
          const eventData = await response.json();
          
          // Populate form with event data
          setTitle(eventData.title || "");
          setDescription(eventData.description || "");
          setLocation(eventData.location || "");
          setCheckWeather(eventData.checkWeather || false);
          setIsRecurring(eventData.isRecurring || false);
          
          if (eventData.projectId) {
            setProjectId(String(eventData.projectId));
          }
          
          // Format dates and times
          if (eventData.startDate) {
            const startDateTime = new Date(eventData.startDate);
            setStartDate(format(startDateTime, "yyyy-MM-dd"));
            setStartTime(format(startDateTime, "HH:mm"));
          }

          if (eventData.endDate) {
            const endDateTime = new Date(eventData.endDate);
            setEndDate(format(endDateTime, "yyyy-MM-dd"));
            setEndTime(format(endDateTime, "HH:mm"));
          }

          // Handle recurring pattern if available
          if (eventData.recurringPattern) {
            setRecurrenceType(eventData.recurringPattern.frequency || "day");
            setRecurrenceInterval(eventData.recurringPattern.interval || 1);

            if (eventData.recurringPattern.endDate) {
              const recurrenceEnd = new Date(eventData.recurringPattern.endDate);
              setRecurrenceEndDate(format(recurrenceEnd, "yyyy-MM-dd"));
            }
          }
        } catch (error) {
          console.error("Error fetching event:", error);
          toast({
            title: "Error",
            description: "Failed to load event details.",
            variant: "destructive",
          });
        }
      };
      
      fetchEvent();
    }
  }, [editEventId, isOpen, toast]);

  // Modify the createEventMutation to handle both create and update
  const eventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      // If we have an editEventId, update the existing event
      if (editEventId) {
        const response = await apiRequest("PUT", `/api/events/${editEventId}`, eventData);
        return response.json();
      } 
      // Otherwise create a new event
      else {
        const response = await apiRequest("POST", "/api/events", eventData);
        return response.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: editEventId ? "Event updated" : "Event created",
        description: editEventId 
          ? "The event has been successfully updated." 
          : "The event has been successfully created.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `There was an error ${editEventId ? "updating" : "creating"} the event. Please try again.`,
        variant: "destructive",
      });
      console.error(`Error ${editEventId ? "updating" : "creating"} event:`, error);
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      await apiRequest("DELETE", `/api/events/${eventId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: "Event deleted",
        description: "The event has been deleted successfully.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "There was an error deleting the event. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting event:", error);
    },
  });

  const handleDelete = () => {
    if (!editEventId) return;
    if (window.confirm(`Delete event "${title}"? This action cannot be undone.`)) {
      deleteEventMutation.mutate(editEventId);
    }
  };

  // Modify the handleSubmit to prevent duplicate submissions
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent duplicate submissions
    if (eventMutation.isPending) {
      console.log("Submission already in progress, preventing duplicate");
      return;
    }
    
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
      // Parse the yyyy-MM-dd input value as local time (matching current behavior)
      const endDate = recurrenceEndDate ? new Date(`${recurrenceEndDate}T00:00`) : null;
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
    
    console.log(`Creating event with data:`, eventData);
    
    // Submit data using the renamed mutation
    eventMutation.mutate(eventData);
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
  

  const selectedProject = projects.find(p => p.id === parseInt(projectId));
  const projectColor = selectedProject ? getProjectColor(selectedProject) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium text-neutral-900">
              {editEventId ? "Edit Event" : "Add New Event"}
            </DialogTitle>
            {projectColor && (
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full ${projectColor.bg}`}></div>
                <span className={`text-sm ${projectColor.lightText}`}>{selectedProject?.name}</span>
              </div>
            )}
          </div>
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
              <SelectTrigger className={`w-full mt-1 ${projectColor ? `border-l-4 ${projectColor.border}` : ''}`}>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => {
                  const projectColor = getProjectColor(project);
                  return (
                    <SelectItem 
                      key={project.id} 
                      value={String(project.id)}
                      className="flex items-center"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${projectColor.bg}`}></div>
                        <span>{project.name}</span>
                      </div>
                    </SelectItem>
                  );
                })}
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
              rows={8}
            />
            <p className="text-xs text-neutral-500 mt-1">
              Markdown supported — steps, materials, rates, safety notes.
            </p>
            {description.trim() !== "" && (
              <div className="mt-2 max-h-48 overflow-y-auto p-3 bg-neutral-50 rounded-md border border-neutral-200 text-sm text-neutral-700">
                <MarkdownRenderer content={description} className="prose-sm" />
              </div>
            )}
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
                onClick={() => {
                  onClose();
                  window.dispatchEvent(new CustomEvent("open-plan-composer", { detail: { goal: title || "" } }));
                }}
                disabled={isLoadingSuggestion}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Plan This Goal
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              {editEventId && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteEventMutation.isPending}
                >
                  {deleteEventMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              )}
              <Button
                type="submit"
                className="bg-primary hover:bg-primary-dark flex-1"
                disabled={eventMutation.isPending || deleteEventMutation.isPending}
              >
                {eventMutation.isPending ? "Saving..." : editEventId ? "Save Changes" : "Create Event"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
