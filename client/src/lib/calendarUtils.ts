import { Event } from "@shared/schema";

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
  
  // Add days from previous month to fill the first row
  const firstDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
  for (let i = firstDayOfWeek; i > 0; i--) {
    const day = new Date(year, month, 1 - i);
    days.push(day);
  }
  
  // Add days of the current month
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  // Add days from next month to fill the last row
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

export function getEventsForDay(events: Event[], date: Date): Event[] {
  return events.filter(event => isSameDay(new Date(event.startDate), date));
}

export function getEventsForMonth(events: Event[], year: number, month: number): Event[] {
  return events.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate.getFullYear() === year && eventDate.getMonth() === month;
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
  
  if (event.allDay) {
    return 'All day';
  }
  
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
    // Handle both Date objects and ISO strings
    const startDate = event.startDate instanceof Date ? event.startDate : new Date(event.startDate);
    const endDate = event.endDate instanceof Date ? event.endDate : new Date(event.endDate);
    
    // Format dates as YYYYMMDDTHHMMSSZ
    const formatICSDate = (date: Date) => {
      return date.toISOString().replace(/-|:|\.\d+/g, '').slice(0, 15) + 'Z';
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
