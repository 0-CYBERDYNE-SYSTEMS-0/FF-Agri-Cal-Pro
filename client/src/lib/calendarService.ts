import { apiRequest } from "@/lib/queryClient";
import { Event, Project, WeatherForecast } from "@shared/schema";
import { exportToICS } from "./calendarUtils";

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

// Add this interface to handle the API's expectation of Date objects
interface APIEventData {
  title: string;
  description: string;
  startDate: Date; // Server expects Date objects
  endDate: Date;   // Server expects Date objects
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
    // Create a new object with converted date fields
    // The server expects actual Date objects, not ISO strings
    const serverEventData = {
      ...eventData,
      // Explicitly convert to Date objects for server validation
      startDate: new Date(eventData.startDate),
      endDate: new Date(eventData.endDate)
    };
    
    // Send the event data to the server
    const response = await apiRequest("POST", "/api/events", serverEventData);
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
      // Just use the original createCalendarEvent function which now handles date conversion
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
 * Creates an .ics file from calendar events and makes it available for download
 */
export function downloadCalendarAsICS(events: Event[], filename = 'farm-calendar.ics'): void {
  const icsContent = exportToICS(events);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Parses ICS content and converts it to Event objects
 */
export function parseICSContent(icsContent: string): Partial<Event>[] {
  const events: Partial<Event>[] = [];
  const lines = icsContent.split(/\r\n|\n|\r/);
  
  let currentEvent: Partial<Event> | null = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      events.push(currentEvent);
      currentEvent = null;
    } else if (currentEvent) {
      const [key, value] = line.split(':');
      
      if (key === 'SUMMARY') {
        currentEvent.title = value;
      } else if (key === 'DESCRIPTION') {
        currentEvent.description = value;
      } else if (key === 'LOCATION') {
        currentEvent.location = value;
      } else if (key === 'DTSTART') {
        currentEvent.startDate = parseICSDate(value);
      } else if (key === 'DTEND') {
        currentEvent.endDate = parseICSDate(value);
      } else if (key === 'UID' && value.includes('@agriplanner.com')) {
        // Extract the ID from the UID if it matches our format
        const id = parseInt(value.split('@')[0]);
        if (!isNaN(id)) {
          currentEvent.id = id;
        }
      }
    }
  }
  
  return events;
}

/**
 * Helper function to parse ICS date format
 */
function parseICSDate(icsDate: string): string {
  // Handle date format like: 20240320T150000Z
  if (icsDate.endsWith('Z')) {
    const year = icsDate.substring(0, 4);
    const month = icsDate.substring(4, 6);
    const day = icsDate.substring(6, 8);
    const hour = icsDate.substring(9, 11);
    const minute = icsDate.substring(11, 13);
    const second = icsDate.substring(13, 15);
    
    return `${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;
  }
  
  // If it's not a UTC date, convert it based on local timezone
  const year = icsDate.substring(0, 4);
  const month = icsDate.substring(4, 6);
  const day = icsDate.substring(6, 8);
  const hour = icsDate.substring(9, 11) || '00';
  const minute = icsDate.substring(11, 13) || '00';
  const second = icsDate.substring(13, 15) || '00';
  
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
  return date.toISOString();
}

/**
 * Import events from an ICS file
 */
export async function importEventsFromICS(file: File): Promise<Partial<Event>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const events = parseICSContent(content);
        resolve(events);
      } catch (error) {
        reject(new Error('Failed to parse ICS file'));
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read ICS file'));
    };
    
    reader.readAsText(file);
  });
}

/**
 * Generates a system message with calendar events in ICS format and weather forecast
 */
export function generateCalendarSystemMessage(
  events: Event[], 
  weatherData?: WeatherForecast[],
  contextInfo?: {
    currentDate: string;
    currentSeason: string;
    userLocation: string;
  }
): string {
  const icsContent = exportToICS(events);
  
  let message = "";
  
  // Add contextual information if available
  if (contextInfo) {
    message += `CONTEXTUAL INFORMATION:

Current date and time: ${contextInfo.currentDate}
Current season: ${contextInfo.currentSeason}
User location: ${contextInfo.userLocation}

`;
  }
  
  message += `Current calendar events in ICS format:
\`\`\`
${icsContent}
\`\`\``;

  // Add weather forecast data if available
  if (weatherData && weatherData.length > 0) {
    message += `\n\nCurrent weather forecast for ${contextInfo?.userLocation || "your location"} for the next ${weatherData.length} days:
\`\`\`json
${JSON.stringify(weatherData, null, 2)}
\`\`\``;
  }
  
  message += `\n\nWhen making recommendations, please consider these scheduled events and weather conditions.
For optimal farm planning, suggest adjustments to existing events based on weather forecasts, or propose new events for agricultural tasks.`;

  return message;
}

/**
 * Enhanced event detection that looks for specially formatted events in AI message
 */
export function detectCalendarEventsInAIMessage(message: string): Partial<AICalendarEvent>[] {
  const events: Partial<AICalendarEvent>[] = [];
  
  // Match pattern: [EVENT] Title: {title}, Date: {date}, Time: {time}, Description: {description}
  const eventRegex = /\[EVENT\]\s+Title:\s*([^,]+),\s*Date:\s*([^,]+),\s*Time:\s*([^,]+),\s*Description:\s*([^\n]+)/g;
  
  let match;
  while ((match = eventRegex.exec(message)) !== null) {
    const [_, title, dateStr, timeStr, description] = match;
    
    // Parse date and time
    let startDate = new Date();
    let endDate = new Date();
    
    try {
      // Try to parse the date
      const dateParts = dateStr.trim().split(/[\/\-\.]/);
      if (dateParts.length === 3) {
        // Assume MM/DD/YYYY format if not specified
        const month = parseInt(dateParts[0]) - 1;
        const day = parseInt(dateParts[1]);
        const year = parseInt(dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2]);
        
        startDate.setFullYear(year, month, day);
        endDate.setFullYear(year, month, day);
      }
      
      // Try to parse the time
      const timeMatch = timeStr.trim().match(/(\d+):?(\d+)?\s*(am|pm|AM|PM)?\s*(?:-|to)\s*(\d+):?(\d+)?\s*(am|pm|AM|PM)?/);
      if (timeMatch) {
        const [_, startHour, startMin, startAmPm, endHour, endMin, endAmPm] = timeMatch;
        
        // Set start time
        let hours = parseInt(startHour);
        if (startAmPm && (startAmPm.toLowerCase() === 'pm') && hours < 12) {
          hours += 12;
        } else if (startAmPm && (startAmPm.toLowerCase() === 'am') && hours === 12) {
          hours = 0;
        }
        
        startDate.setHours(hours);
        startDate.setMinutes(parseInt(startMin || '0'));
        startDate.setSeconds(0);
        
        // Set end time
        hours = parseInt(endHour);
        if (endAmPm && (endAmPm.toLowerCase() === 'pm') && hours < 12) {
          hours += 12;
        } else if (endAmPm && (endAmPm.toLowerCase() === 'am') && hours === 12) {
          hours = 0;
        }
        
        endDate.setHours(hours);
        endDate.setMinutes(parseInt(endMin || '0'));
        endDate.setSeconds(0);
      } else {
        // Default to all-day event
        endDate.setDate(endDate.getDate() + 1);
      }
    } catch (e) {
      console.error("Error parsing date/time for event", e);
      // Use today as fallback
      endDate.setHours(startDate.getHours() + 1);
    }
    
    // Check if this is a weather-dependent event
    const isWeatherDependent = message.includes('[WEATHER-DEPENDENT]');
    
    // Convert Date objects to ISO strings for the API
    const startDateIso = startDate.toISOString();
    const endDateIso = endDate.toISOString();
    
    events.push({
      title: title.trim(),
      startDate: startDateIso,
      endDate: endDateIso,
      description: description.trim(),
      checkWeather: isWeatherDependent
    });
  }
  
  return events;
}

/**
 * Create a calendar event directly from assistant content
 * This is used when the assistant says it has scheduled something
 * @param aiMessage - The AI message content that claims to have scheduled an event
 * @returns True if successful, false otherwise
 */
export async function createEventFromAssistantClaim(aiMessage: string): Promise<boolean> {
  // First, try to extract structured event data
  const detectedEvents = detectCalendarEventsInAIMessage(aiMessage);
  
  if (detectedEvents.length > 0) {
    try {
      // Find project info
      const projectNameMatch = aiMessage.match(/project(?:\s+called|\s+titled|\s+named)?\s+["']([^"']+)["']/i);
      const projectName = projectNameMatch ? projectNameMatch[1] : "Agricultural Project";
      
      // Create or get the project
      const project = await getOrCreateProject(projectName, "Created from AI assistant conversation");
      
      // Complete and create events
      for (const event of detectedEvents) {
        // Fill in missing required fields
        const defaultDate = new Date();
        defaultDate.setHours(9, 0, 0, 0); // 9 AM
        
        const defaultEndDate = new Date(defaultDate);
        defaultEndDate.setHours(defaultEndDate.getHours() + 1); // 1 hour later
        
        const completeEvent: AICalendarEvent = {
          title: event.title || "Agricultural Task",
          description: event.description || "",
          startDate: event.startDate || defaultDate.toISOString(),
          endDate: event.endDate || defaultEndDate.toISOString(),
          projectId: project.id,
          location: event.location || "",
          checkWeather: true
        };
        
        // Create event directly through API
        await createCalendarEvent(completeEvent);
      }
      
      return true;
    } catch (error) {
      console.error("Error auto-creating events from assistant claim:", error);
      return false;
    }
  }
  
  // If no structured events were found, look for direct mentions of scheduling
  const schedulingMentioned = aiMessage.match(/I('ve| have) scheduled|calendar event scheduled|event has been added|added to your calendar|has been successfully scheduled|been scheduled for|scheduled.*for tomorrow|The event for|I('ve| have) added|I('ve| have) created|has been created|has been set up/i);
  
  if (schedulingMentioned) {
    try {
      // Extract minimal event info
      const titleMatch = aiMessage.match(/Event: ([^\n]+)/i) || 
                         aiMessage.match(/scheduled ["]([^"]+)["]/i) ||
                         aiMessage.match(/scheduled [']([^']+)[']/i) ||
                         aiMessage.match(/scheduled ([\w\s-]+)( for| on| at)/i) ||
                         aiMessage.match(/The event for (turning the compost|[\w\s-]+)( has| is)/i) ||
                         aiMessage.match(/titled ["']([^"']+)["']/i) ||
                         aiMessage.match(/added ["']([^"']+)["']/i) ||
                         aiMessage.match(/created ["']([^"']+)["']/i) ||
                         aiMessage.match(/(?:for|regarding) ["']([^"']+)["']/i) ||
                         aiMessage.match(/to turn (?:the )?compost(?: pile)?s?/i) ?
                           { 1: "Turn Compost Piles" } : null;
      
      const dateMatch = aiMessage.match(/Date: ([^\n]+)/i) || 
                        aiMessage.match(/(tomorrow|today|on [^,\.]+|\w+ \d{1,2}(?:st|nd|rd|th)?)/i) ||
                        aiMessage.match(/scheduled for ([\w\s,]+)(?:\sat|\sfrom)/i);
      
      const timeMatch = aiMessage.match(/Time: ([^\n]+)/i) || 
                        aiMessage.match(/at (\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))?)/i) ||
                        aiMessage.match(/from (\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\s*to\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))/i);
      
      if (titleMatch || (schedulingMentioned && aiMessage.includes("compost"))) {
        // If we have a compost reference but no title match, use a default title
        const title = titleMatch ? titleMatch[1].trim() : "Turn Compost Piles";
        
        let startDate = new Date();
        startDate.setDate(startDate.getDate() + 1); // Default to tomorrow
        let endDate = new Date(startDate);
        endDate.setHours(endDate.getHours() + 1);
        
        // Try to parse date from text
        if (dateMatch) {
          const dateText = dateMatch[1] || dateMatch[0];
          const parsedDate = parseNaturalDate(dateText);
          if (parsedDate) {
            startDate = parsedDate;
            endDate = new Date(startDate);
            endDate.setHours(endDate.getHours() + 1);
          }
        }
        
        // Try to parse time from text
        if (timeMatch && timeMatch[1]) {
          const timeText = timeMatch[1];
          const timeRangeMatch = timeText.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
          
          if (timeRangeMatch) {
            // Handle time range (start and end)
            const startTimeText = timeRangeMatch[1];
            const endTimeText = timeRangeMatch[2];
            
            const startTimeParts = startTimeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (startTimeParts) {
              let hours = parseInt(startTimeParts[1]);
              const minutes = startTimeParts[2] ? parseInt(startTimeParts[2]) : 0;
              const ampm = startTimeParts[3] ? startTimeParts[3].toLowerCase() : null;
              
              if (ampm === "pm" && hours < 12) hours += 12;
              if (ampm === "am" && hours === 12) hours = 0;
              
              startDate.setHours(hours, minutes, 0, 0);
            }
            
            const endTimeParts = endTimeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (endTimeParts) {
              let hours = parseInt(endTimeParts[1]);
              const minutes = endTimeParts[2] ? parseInt(endTimeParts[2]) : 0;
              const ampm = endTimeParts[3] ? endTimeParts[3].toLowerCase() : null;
              
              if (ampm === "pm" && hours < 12) hours += 12;
              if (ampm === "am" && hours === 12) hours = 0;
              
              endDate.setHours(hours, minutes, 0, 0);
            }
          } else {
            // Handle single time (start only)
            const timeParts = timeText.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
            if (timeParts) {
              let hours = parseInt(timeParts[1]);
              const minutes = timeParts[2] ? parseInt(timeParts[2]) : 0;
              const ampm = timeParts[3] ? timeParts[3].toLowerCase() : null;
              
              if (ampm === "pm" && hours < 12) hours += 12;
              if (ampm === "am" && hours === 12) hours = 0;
              
              startDate.setHours(hours, minutes, 0, 0);
              endDate = new Date(startDate);
              endDate.setHours(endDate.getHours() + 1);
            }
          }
        }
        
        // Extract description
        const descMatch = aiMessage.match(/description: ([^\n]+(?:\n[^\n#*]+)*)/i) || 
                          aiMessage.match(/I've scheduled[^.]*\.\s+([^.]+\.)/i);
        const description = descMatch ? descMatch[1].trim() : 
                           "Auto-created from assistant conversation";
        
        // Create project
        const project = await getOrCreateProject("Agricultural Tasks", "Auto-created from assistant");
        
        // Create the event
        const event: AICalendarEvent = {
          title,
          description,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          projectId: project.id,
          location: "",
          checkWeather: true
        };
        
        await createCalendarEvent(event);
        return true;
      }
    } catch (error) {
      console.error("Error creating fallback event from assistant claim:", error);
      return false;
    }
  }
  
  return false;
}