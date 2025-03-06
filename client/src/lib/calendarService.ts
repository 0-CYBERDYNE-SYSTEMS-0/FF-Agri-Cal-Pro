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
    const lowerDateText = dateText.toLowerCase().trim();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Direct matches
    if (lowerDateText === "today") {
      return new Date(now.setHours(9, 0, 0, 0)); // 9 AM today
    }
    
    if (lowerDateText === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0); // 9 AM tomorrow
      return tomorrow;
    }
    
    // Handle relative days
    if (lowerDateText.includes("next week")) {
      const nextWeek = new Date(now);
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(9, 0, 0, 0);
      return nextWeek;
    }
    
    // Handle day of week references
    const daysOfWeek = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    for (let i = 0; i < daysOfWeek.length; i++) {
      const dayName = daysOfWeek[i];
      
      // "This Monday", "Next Monday", etc.
      if (lowerDateText.includes(`this ${dayName}`) || lowerDateText === dayName) {
        const targetDay = i;
        const currentDay = now.getDay();
        const daysToAdd = (targetDay + 7 - currentDay) % 7;
        
        const date = new Date(now);
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(9, 0, 0, 0);
        return date;
      }
      
      if (lowerDateText.includes(`next ${dayName}`)) {
        const targetDay = i;
        const currentDay = now.getDay();
        const daysToAdd = (targetDay + 7 - currentDay) % 7 + 7; // +7 ensures it's next week
        
        const date = new Date(now);
        date.setDate(date.getDate() + daysToAdd);
        date.setHours(9, 0, 0, 0);
        return date;
      }
    }
    
    // Handle month names with optional day and year
    const monthNames = [
      "january", "february", "march", "april", "may", "june", 
      "july", "august", "september", "october", "november", "december"
    ];
    
    for (let i = 0; i < monthNames.length; i++) {
      const monthName = monthNames[i];
      
      if (lowerDateText.includes(monthName)) {
        // Extract day and year if present
        const dayMatch = lowerDateText.match(new RegExp(`${monthName}\\s+(\\d{1,2})(?:st|nd|rd|th)?`, "i"));
        const yearMatch = lowerDateText.match(/\b(20\d{2})\b/);
        
        const day = dayMatch ? parseInt(dayMatch[1]) : 1;
        const year = yearMatch ? parseInt(yearMatch[1]) : currentYear;
        
        // Handle "next month name" - increment year if it's a past month
        let month = i;
        if (lowerDateText.includes(`next ${monthName}`) && month <= currentMonth) {
          // If it's "next January" and we're currently in July, it means January next year
          const date = new Date(year + 1, month, day, 9, 0, 0, 0);
          return date;
        }
        
        const date = new Date(year, month, day, 9, 0, 0, 0);
        
        // If date is in the past and no year was specified, assume next year
        if (!yearMatch && date < now) {
          date.setFullYear(currentYear + 1);
        }
        
        return date;
      }
    }
    
    // Handle numeric dates in various formats
    // MM/DD/YYYY or DD/MM/YYYY
    const slashDateMatch = lowerDateText.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashDateMatch) {
      const part1 = parseInt(slashDateMatch[1]);
      const part2 = parseInt(slashDateMatch[2]);
      const yearPart = slashDateMatch[3] ? parseInt(slashDateMatch[3]) : currentYear;
      
      // Disambiguate MM/DD vs DD/MM based on values
      let month, day, year;
      
      // If first part > 12, it must be a day
      if (part1 > 12) {
        day = part1;
        month = part2 - 1; // 0-indexed months
      } else {
        // US format as default: MM/DD
        month = part1 - 1;
        day = part2;
      }
      
      // Handle 2-digit years
      year = yearPart < 100 ? 2000 + yearPart : yearPart;
      
      return new Date(year, month, day, 9, 0, 0, 0);
    }
    
    // ISO format: YYYY-MM-DD
    const isoDateMatch = lowerDateText.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoDateMatch) {
      const year = parseInt(isoDateMatch[1]);
      const month = parseInt(isoDateMatch[2]) - 1; // 0-indexed months
      const day = parseInt(isoDateMatch[3]);
      
      return new Date(year, month, day, 9, 0, 0, 0);
    }
    
    // Try standard Date.parse as fallback for other formats
    const timestamp = Date.parse(dateText);
    if (!isNaN(timestamp)) {
      const date = new Date(timestamp);
      // Set to 9 AM if it's midnight exactly (likely just a date without time)
      if (date.getHours() === 0 && date.getMinutes() === 0) {
        date.setHours(9, 0, 0, 0);
      }
      return date;
    }
    
    // If we get here, parsing failed
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
  
  // First try to detect formatted calendar events (more structured format)
  const formattedEventMatches = text.match(/Event\s*\d*:\s*([^\n]+)(?:\n|.)*?Date:\s*([^\n]+)(?:\n|.)*?(?:Time:\s*([^\n]+))?(?:\n|.)*?(?:Description:\s*([^\n]+(?:\n[^\n#*]+)*))?/gi);
  
  if (formattedEventMatches && formattedEventMatches.length > 0) {
    for (const eventText of formattedEventMatches) {
      // Extract title
      const titleMatch = eventText.match(/Event\s*\d*:\s*([^\n]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : "Agricultural Task";
      
      // Extract date
      const dateMatch = eventText.match(/Date:\s*([^\n]+)/i);
      let startDate: Date | null = null;
      if (dateMatch) {
        startDate = parseNaturalDate(dateMatch[1].trim());
      }
      
      // Extract time if available
      const timeMatch = eventText.match(/Time:\s*([^\n]+)/i);
      if (timeMatch && startDate) {
        const timeText = timeMatch[1].trim();
        
        // Try to parse time formats like "9 AM to 11 AM" or "9:00 - 11:00"
        const timeRangeMatch = timeText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
        
        if (timeRangeMatch) {
          const startTimeText = timeRangeMatch[1].trim();
          const endTimeText = timeRangeMatch[2].trim();
          
          // Parse start time
          const startTimeParts = startTimeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (startTimeParts) {
            let hours = parseInt(startTimeParts[1]);
            const minutes = startTimeParts[2] ? parseInt(startTimeParts[2]) : 0;
            const ampm = startTimeParts[3] ? startTimeParts[3].toLowerCase() : null;
            
            // Convert to 24-hour format if needed
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
            
            startDate.setHours(hours, minutes, 0, 0);
          }
          
          // Create end date
          const endDate = new Date(startDate);
          
          // Parse end time
          const endTimeParts = endTimeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (endTimeParts) {
            let hours = parseInt(endTimeParts[1]);
            const minutes = endTimeParts[2] ? parseInt(endTimeParts[2]) : 0;
            const ampm = endTimeParts[3] ? endTimeParts[3].toLowerCase() : null;
            
            // Convert to 24-hour format if needed
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
            
            endDate.setHours(hours, minutes, 0, 0);
          } else {
            // Default to 1 hour later
            endDate.setHours(endDate.getHours() + 1);
          }
          
          const event: Partial<AICalendarEvent> = {
            title,
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString()
          };
          
          // Extract description
          const descriptionMatch = eventText.match(/Description:\s*([^\n]+(?:\n[^\n#*]+)*)/i);
          if (descriptionMatch) {
            event.description = descriptionMatch[1].trim();
          } else {
            event.description = `${title} scheduled for ${startDate.toLocaleDateString()}`;
          }
          
          // Extract location if any
          const locationMatch = eventText.match(/Location:\s*([^\n]+)/i);
          if (locationMatch) {
            event.location = locationMatch[1].trim();
          }
          
          events.push(event);
        } else {
          // Single time format like "9 AM"
          const timePartMatch = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (timePartMatch && startDate) {
            let hours = parseInt(timePartMatch[1]);
            const minutes = timePartMatch[2] ? parseInt(timePartMatch[2]) : 0;
            const ampm = timePartMatch[3] ? timePartMatch[3].toLowerCase() : null;
            
            // Convert to 24-hour format if needed
            if (ampm === "pm" && hours < 12) hours += 12;
            if (ampm === "am" && hours === 12) hours = 0;
            
            startDate.setHours(hours, minutes, 0, 0);
            
            // End date is 1 hour after start by default
            const endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
            
            const event: Partial<AICalendarEvent> = {
              title,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString()
            };
            
            // Extract description
            const descriptionMatch = eventText.match(/Description:\s*([^\n]+(?:\n[^\n#*]+)*)/i);
            if (descriptionMatch) {
              event.description = descriptionMatch[1].trim();
            } else {
              event.description = `${title} scheduled for ${startDate.toLocaleDateString()}`;
            }
            
            // Extract location if any
            const locationMatch = eventText.match(/Location:\s*([^\n]+)/i);
            if (locationMatch) {
              event.location = locationMatch[1].trim();
            }
            
            events.push(event);
          }
        }
      } else if (startDate) {
        // No time specified, use default (9 AM - 10 AM)
        const endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
        
        const event: Partial<AICalendarEvent> = {
          title,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        };
        
        // Extract description
        const descriptionMatch = eventText.match(/Description:\s*([^\n]+(?:\n[^\n#*]+)*)/i);
        if (descriptionMatch) {
          event.description = descriptionMatch[1].trim();
        } else {
          event.description = `${title} scheduled for ${startDate.toLocaleDateString()}`;
        }
        
        // Extract location if any
        const locationMatch = eventText.match(/Location:\s*([^\n]+)/i);
        if (locationMatch) {
          event.location = locationMatch[1].trim();
        }
        
        events.push(event);
      }
    }
    
    // Return formatted events if found
    if (events.length > 0) {
      return events;
    }
  }
  
  // Fallback to parsing list-based or section-based events
  // Look for common event patterns in text - bulleted lists, numbered lists, or sections with headings
  const eventSections = text.split(/\n(?:#{1,3}|\d+\.|\*)\s+/g).filter(Boolean);
  
  for (const section of eventSections) {
    if (section.length < 10) continue; // Skip very short sections
    
    // Extract potential event titles (first line or heading)
    const titleMatch = section.match(/^([^:\n\r]+)(?::|[\n\r])/);
    const title = titleMatch ? titleMatch[1].trim() : "";
    
    if (!title) continue;
    
    // Create event with title and description
    const event: Partial<AICalendarEvent> = {
      title,
      description: section.trim(),
    };
    
    // Look for dates in various formats
    // Standard date formats
    const dateRegex = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2}(?:st|nd|rd|th)?,? \d{4})/gi;
    const dateMatches = section.match(dateRegex);
    
    // Natural language dates
    const nlDateRegex = /\b(today|tomorrow|next week|this (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/gi;
    const nlDateMatches = section.match(nlDateRegex);
    
    // Combine all date references
    const allDateRefs = [
      ...(dateMatches || []),
      ...(nlDateMatches || [])
    ];
    
    // If dates found, use them for start/end dates
    if (allDateRefs.length > 0) {
      const firstDate = parseNaturalDate(allDateRefs[0]);
      if (firstDate) {
        event.startDate = firstDate.toISOString();
        
        // If a second date is found, use it as end date
        if (allDateRefs.length > 1) {
          const secondDate = parseNaturalDate(allDateRefs[1]);
          if (secondDate) {
            event.endDate = secondDate.toISOString();
          } else {
            // Default end date is 1 hour after start
            const endDate = new Date(firstDate);
            endDate.setHours(endDate.getHours() + 1);
            event.endDate = endDate.toISOString();
          }
        } else {
          // Default end date is 1 hour after start
          const endDate = new Date(firstDate);
          endDate.setHours(endDate.getHours() + 1);
          event.endDate = endDate.toISOString();
        }
      }
    }
    
    // Look for time information 
    const timeRegex = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/gi;
    const timeMatches = section.match(timeRegex);
    
    if (timeMatches && timeMatches.length > 0 && event.startDate) {
      const timeStr = timeMatches[0];
      const timeRangeParts = timeStr.split(/\s*(?:to|-)\s*/i);
      
      // Start time
      const startTime = timeRangeParts[0].trim();
      const startTimeParts = startTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
      
      if (startTimeParts) {
        let hours = parseInt(startTimeParts[1]);
        const minutes = startTimeParts[2] ? parseInt(startTimeParts[2]) : 0;
        const ampm = startTimeParts[3] ? startTimeParts[3].toLowerCase() : null;
        
        // Convert to 24-hour format if needed
        if (ampm === "pm" && hours < 12) hours += 12;
        if (ampm === "am" && hours === 12) hours = 0;
        
        // Update start date with time information
        const startDate = new Date(event.startDate);
        startDate.setHours(hours, minutes, 0, 0);
        event.startDate = startDate.toISOString();
        
        // Process end time if available
        if (timeRangeParts.length > 1) {
          const endTime = timeRangeParts[1].trim();
          const endTimeParts = endTime.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          
          if (endTimeParts) {
            let endHours = parseInt(endTimeParts[1]);
            const endMinutes = endTimeParts[2] ? parseInt(endTimeParts[2]) : 0;
            const endAmpm = endTimeParts[3] ? endTimeParts[3].toLowerCase() : null;
            
            // Convert to 24-hour format if needed
            if (endAmpm === "pm" && endHours < 12) endHours += 12;
            if (endAmpm === "am" && endHours === 12) endHours = 0;
            
            // Update end date with time information
            const endDate = new Date(startDate);
            endDate.setHours(endHours, endMinutes, 0, 0);
            
            // If end time is earlier than start time, assume it's the next day
            if (endDate < startDate) {
              endDate.setDate(endDate.getDate() + 1);
            }
            
            event.endDate = endDate.toISOString();
          }
        } else if (event.endDate) {
          // No explicit end time, set it to 1 hour after start
          const endDate = new Date(startDate);
          endDate.setHours(endDate.getHours() + 1);
          event.endDate = endDate.toISOString();
        }
      }
    }
    
    // Extract location if mentioned
    const locationMatch = section.match(/(?:location|place|venue|at):\s*([^\n\r\.]+)/i);
    if (locationMatch) {
      event.location = locationMatch[1].trim();
    }
    
    // Add event if it has at least a title and either a start date or description
    if (event.title && (event.startDate || event.description)) {
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
  // Quickly reject if there's no event-related content
  if (!message || message.length < 20) return [];

  // Check if message explicitly has a calendar section
  if (message.match(/calendar events:|events to add:|suggested events:|proposed schedule:/i)) {
    return extractEventsFromText(message);
  }
  
  // Use regex pattern matching to find event indicators
  const hasEventKeywords = /\b(schedule|event|calendar|task|plan|plant|harvest|fertilize|irrigate)\b/i.test(message);
  const hasDatePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|today|tomorrow|next week)\b|(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/i.test(message);
  const hasTimePattern = /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)(?:\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?))?/i.test(message);
  
  // Return extracted events if we have indicators of events
  if ((hasEventKeywords && hasDatePattern) || message.includes("Event:")) {
    return extractEventsFromText(message);
  }
  
  return [];
}