import { Event } from "@shared/schema";

// ── Recurrence Expansion Types ──────────────────────────────────────────────

export interface RecurringPattern {
  frequency: "day" | "week" | "month" | "year";
  interval: number;
  endDate: string | null;
}

/** An Event that may be an expanded recurrence instance */
export interface ExpandedEvent extends Event {
  instanceDate: Date;
  isRecurrenceInstance: boolean;
}

// ── Recurrence Engine ───────────────────────────────────────────────────────

function monthDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Check if a given date falls on an event's recurrence pattern */
function isDateInRecurrence(
  eventStart: Date,
  checkDate: Date,
  pattern: RecurringPattern
): boolean {
  if (checkDate < eventStart) return false;
  if (pattern.endDate) {
    const end = new Date(pattern.endDate);
    // Compare date-only (ignore time)
    const checkDay = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (checkDay > endDay) return false;
  }

  const dayDiff = Math.floor(
    (checkDate.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)
  );

  switch (pattern.frequency) {
    case "day":
      return dayDiff >= 0 && dayDiff % pattern.interval === 0;

    case "week":
      return dayDiff >= 0 && dayDiff % (pattern.interval * 7) === 0;

    case "month":
      return (
        checkDate.getDate() === eventStart.getDate() &&
        monthDiff(eventStart, checkDate) >= 0 &&
        monthDiff(eventStart, checkDate) % pattern.interval === 0
      );

    case "year":
      return (
        checkDate.getMonth() === eventStart.getMonth() &&
        checkDate.getDate() === eventStart.getDate() &&
        checkDate.getFullYear() >= eventStart.getFullYear() &&
        (checkDate.getFullYear() - eventStart.getFullYear()) % pattern.interval === 0
      );

    default:
      return false;
  }
}

/** Expand a single event into all its occurrences (original + recurrence instances) */
function expandEvent(event: Event, rangeStart: Date, rangeEnd: Date): ExpandedEvent[] {
  const instances: ExpandedEvent[] = [];
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const duration = end.getTime() - start.getTime();

  // Original occurrence
  if (start >= rangeStart && start <= rangeEnd) {
    instances.push({ ...event, instanceDate: start, isRecurrenceInstance: false });
  }

  // Recurrence instances
  if (event.isRecurring && event.recurringPattern) {
    const pattern = event.recurringPattern as unknown as RecurringPattern;
    if (!pattern.frequency || !pattern.interval) return instances;

    // Walk forward from start date through the range
    let cursor = new Date(start);
    let safety = 0;
    const MAX_INSTANCES = 500; // safety valve

    while (cursor <= rangeEnd && safety < MAX_INSTANCES) {
      // Advance cursor by one interval unit
      switch (pattern.frequency) {
        case "day":
          cursor = new Date(cursor.getTime() + pattern.interval * 24 * 60 * 60 * 1000);
          break;
        case "week":
          cursor = new Date(cursor.getTime() + pattern.interval * 7 * 24 * 60 * 60 * 1000);
          break;
        case "month":
          cursor = new Date(cursor.getFullYear(), cursor.getMonth() + pattern.interval, cursor.getDate());
          break;
        case "year":
          cursor = new Date(cursor.getFullYear() + pattern.interval, cursor.getMonth(), cursor.getDate());
          break;
      }

      // Check bounds
      if (cursor > rangeEnd) break;
      if (pattern.endDate && cursor > new Date(pattern.endDate)) break;

      // Check date validity (month rollover can produce invalid dates)
      if (cursor.getDate() !== start.getDate() && pattern.frequency === "month") {
        // E.g., Jan 31 → Feb 31 → clamped to Feb 28/29 by JS. Skip invalid.
        continue;
      }

      if (cursor >= rangeStart) {
        const instanceEnd = new Date(cursor.getTime() + duration);
        instances.push({
          ...event,
          startDate: cursor,
          endDate: instanceEnd,
          instanceDate: cursor,
          isRecurrenceInstance: true,
        });
      }

      safety++;
    }
  }

  return instances;
}

/** Expand all events within a date range, including recurrence instances */
export function expandRecurringEvents(
  events: Event[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent[] {
  const expanded: ExpandedEvent[] = [];
  for (const event of events) {
    expanded.push(...expandEvent(event, rangeStart, rangeEnd));
  }
  // Sort by start date
  expanded.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  return expanded;
}

// ── Date Utilities ──────────────────────────────────────────────────────────

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat('en-US', options).format(date);
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getMonthDays(year: number, month: number): Date[] {
  const daysInMonth = getDaysInMonth(year, month);
  const days: Date[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  return days;
}

export function getCalendarDays(year: number, month: number): Date[] {
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month, getDaysInMonth(year, month));
  const days: Date[] = [];
  const firstDayOfWeek = firstDayOfMonth.getDay();
  for (let i = firstDayOfWeek; i > 0; i--) {
    days.push(new Date(year, month, 1 - i));
  }
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  const lastDayOfWeek = lastDayOfMonth.getDay();
  for (let i = 1; i < 7 - lastDayOfWeek; i++) {
    days.push(new Date(year, month + 1, i));
  }
  return days;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

export function isSameMonth(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Get all events for a day, including expanded recurrence instances */
export function getEventsForDay(events: ExpandedEvent[], date: Date): ExpandedEvent[] {
  return events.filter(event => isSameDay(event.instanceDate || new Date(event.startDate), date));
}

export function getEventsForMonth(events: ExpandedEvent[], year: number, month: number): ExpandedEvent[] {
  return events.filter(event => {
    const d = event.instanceDate || new Date(event.startDate);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

export function formatTimeRange(start: Date, end: Date): string {
  const startTime = formatDate(start, { hour: 'numeric', minute: '2-digit' });
  const endTime = formatDate(end, { hour: 'numeric', minute: '2-digit' });
  return `${startTime} - ${endTime}`;
}

export function formatEventTime(event: Event): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (event.allDay) return 'All day';
  return formatTimeRange(start, end);
}

export function exportToICS(events: Event[]): string {
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AgriPlanner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ];
  events.forEach(event => {
    const startDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
    const endDate = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\\.\\d+/g, '').slice(0, 15) + 'Z';
    };
    icsContent = [
      ...icsContent,
      'BEGIN:VEVENT',
      `UID:${event.id}@agriplanner.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(startDate)}`,
      `DTEND:${formatICSDate(endDate)}`,
      `SUMMARY:${event.title}`,
      `DESCRIPTION:${event.description || ''}`,
      `LOCATION:${event.location || ''}`,
      'END:VEVENT'
    ];
  });
  icsContent.push('END:VCALENDAR');
  return icsContent.join('\r\n');
}

export function downloadICSFile(events: Event[], filename = 'calendar.ics'): void {
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
