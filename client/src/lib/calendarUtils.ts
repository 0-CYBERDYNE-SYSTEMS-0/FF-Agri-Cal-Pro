import { Event } from "@shared/schema";
import {
  expandRecurringEvents as expandRecurrences,
  ExpandedEvent as ExpandedRecurrenceEvent,
} from "@shared/recurrence";
import { serializeICS } from "@shared/ics";

export type RecurringPattern = {
  frequency: "day" | "week" | "month" | "year";
  interval: number;
  endDate: string | null;
};

export type ExpandedEvent = ExpandedRecurrenceEvent<Event>;

export { expandRecurrences as expandRecurringEvents };

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

/** All occurrences visible on a day, including multi-day events that overlap it */
export function getEventsForDay(events: ExpandedEvent[], date: Date): ExpandedEvent[] {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  return events.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return start.getTime() < dayEnd.getTime() && end.getTime() >= dayStart.getTime();
  });
}

export function getEventsForMonth(events: ExpandedEvent[], year: number, month: number): ExpandedEvent[] {
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1);
  return events.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return start.getTime() < monthEnd.getTime() && end.getTime() >= monthStart.getTime();
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
  return serializeICS(events.map(event => ({
    id: event.id,
    uid: event.uid,
    title: event.title,
    description: event.description,
    location: event.location,
    startDate: event.startDate,
    endDate: event.endDate,
    allDay: event.allDay,
    checkWeather: event.checkWeather,
    projectId: event.projectId,
    isRecurring: event.isRecurring,
    recurringPattern: event.recurringPattern as RecurringPattern | null,
  })));
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
