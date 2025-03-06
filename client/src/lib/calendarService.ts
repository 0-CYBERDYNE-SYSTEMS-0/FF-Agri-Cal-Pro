import { apiRequest } from "@/lib/queryClient";
import { Event, Project } from "@shared/schema";

/**
 * Service for creating calendar events directly from the AI assistant
 */

// Interface for a calendar event that can be created from AI suggestions
export interface AICalendarEvent {
  title: string;
  description: string;
  startDate: string; // ISO date string
  endDate: string;   // ISO date string
  projectId?: number;
  location?: string;
  checkWeather?: boolean;
  isRecurring?: boolean;
  recurringPattern?: {
    frequency: "day" | "week" | "month" | "year";
    interval: number;
    endDate: string | null;
  } | null;
}

/**
 * Create a single calendar event
 * @param eventData - The event data to create
 * @returns The created event
 */
export async function createCalendarEvent(eventData: AICalendarEvent): Promise<Event> {
  try {
    const response = await apiRequest("POST", "/api/events", eventData);
    return await response.json();
  } catch (error) {
    console.error("Error creating calendar event:", error);
    throw error;
  }
}

/**
 * Create multiple calendar events in a batch
 * @param events - Array of event data to create
 * @returns Array of created events
 */
export async function createCalendarEventBatch(events: AICalendarEvent[]): Promise<Event[]> {
  try {
    const createdEvents: Event[] = [];
    
    // Create events sequentially to avoid race conditions
    for (const event of events) {
      const createdEvent = await createCalendarEvent(event);
      createdEvents.push(createdEvent);
    }
    
    return createdEvents;
  } catch (error) {
    console.error("Error creating calendar events batch:", error);
    throw error;
  }
}

/**
 * Create a new project if it doesn't exist
 * @param projectName - The name of the project
 * @param description - Optional project description
 * @returns The created or existing project
 */
export async function getOrCreateProject(projectName: string, description?: string): Promise<Project> {
  try {
    // Fetch all projects
    const response = await apiRequest("GET", "/api/projects");
    const projects: Project[] = await response.json();
    
    // Check if project already exists
    const existingProject = projects.find(p => 
      p.name.toLowerCase() === projectName.toLowerCase()
    );
    
    if (existingProject) {
      return existingProject;
    }
    
    // Create new project if it doesn't exist
    const newProject = {
      name: projectName,
      description: description || "",
      status: "active",
      startDate: new Date().toISOString(),
      endDate: null
    };
    
    const createResponse = await apiRequest("POST", "/api/projects", newProject);
    return await createResponse.json();
  } catch (error) {
    console.error("Error getting or creating project:", error);
    throw error;
  }
}

/**
 * Parse natural language dates into JavaScript Date objects
 * @param dateText - Natural language date string (e.g., "tomorrow", "next Monday", "March 15th")
 * @returns JavaScript Date object or null if parsing fails
 */
export function parseNaturalDate(dateText: string): Date | null {
  try {
    // Handle common phrases
    const lowerDateText = dateText.toLowerCase();
    const now = new Date();
    
    if (lowerDateText === "today") {
      return now;
    }
    
    if (lowerDateText === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
    
    if (lowerDateText.includes("next week")) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      return nextWeek;
    }
    
    // Try using Date.parse for other date formats
    const timestamp = Date.parse(dateText);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    
    // Fall back to current date if parsing fails
    return null;
  } catch (error) {
    console.error("Error parsing natural date:", error);
    return null;
  }
}

/**
 * Extract likely calendar events from AI assistant text
 * @param text - The text to parse for event information
 * @returns Array of potential calendar events
 */
export function extractEventsFromText(text: string): Partial<AICalendarEvent>[] {
  const events: Partial<AICalendarEvent>[] = [];
  
  // Look for common event patterns in text
  const eventSections = text.split(/\n(?:#{1,3}|\d+\.|\*)\s+/g).filter(Boolean);
  
  for (const section of eventSections) {
    if (section.length < 10) continue; // Skip very short sections
    
    // Extract potential event titles (first line or heading)
    const titleMatch = section.match(/^([^:\n\r]+)(?::|[\n\r])/);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    if (!title) continue;
    
    // Look for dates in the section
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4})/g;
    const dateMatches = section.match(dateRegex);
    
    const event: Partial<AICalendarEvent> = {
      title,
      description: section.trim(),
    };
    
    // If dates found, use them for start/end dates
    if (dateMatches && dateMatches.length > 0) {
      const firstDate = parseNaturalDate(dateMatches[0]);
      if (firstDate) {
        event.startDate = firstDate.toISOString();
        
        // If a second date is found, use it as end date
        if (dateMatches.length > 1) {
          const secondDate = parseNaturalDate(dateMatches[1]);
          if (secondDate) {
            event.endDate = secondDate.toISOString();
          }
        } else {
          // Default end date is 1 hour after start
          const endDate = new Date(firstDate);
          endDate.setHours(endDate.getHours() + 1);
          event.endDate = endDate.toISOString();
        }
      }
    }
    
    // Extract location if mentioned
    const locationMatch = section.match(/location:\s*([^\n\r]+)/i);
    if (locationMatch) {
      event.location = locationMatch[1].trim();
    }
    
    // Only add events with at least title and description
    if (event.title && event.description) {
      events.push(event);
    }
  }
  
  return events;
}

/**
 * Process AI message to detect and extract calendar events
 * @param message - The AI message to process
 * @returns Array of potential calendar events
 */
export function detectCalendarEventsInAIMessage(message: string): Partial<AICalendarEvent>[] {
  // Check if message likely contains event information
  const hasEventKeywords = /\b(schedule|event|calendar|task|plan)\b/i.test(message);
  const hasDatePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/i.test(message);
  
  if (hasEventKeywords && hasDatePattern) {
    return extractEventsFromText(message);
  }
  
  return [];
}