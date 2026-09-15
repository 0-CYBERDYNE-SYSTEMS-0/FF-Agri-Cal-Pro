import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { Event } from "@shared/schema";
import { formatDate, expandRecurringEvents, ExpandedEvent, getCalendarDays } from "@/lib/calendarUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";

type CalendarViewType = "day" | "week" | "month" | "year";

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  events: ExpandedEvent[];
  isLoading: boolean;
  refreshEvents: () => void;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  formatCurrentMonthYear: () => string;
}

const CalendarContext = createContext<CalendarContextType>({
  currentDate: new Date(),
  view: "month",
  events: [],
  isLoading: false,
  refreshEvents: () => {},
  setCurrentDate: () => {},
  setView: () => {},
  goToToday: () => {},
  goToPrev: () => {},
  goToNext: () => {},
  formatCurrentMonthYear: () => ""
});

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

// The visible range of the active view; occurrences are derived for exactly
// this range instead of a fixed wall-clock window.
function visibleRange(view: CalendarViewType, currentDate: Date): { start: Date; end: Date } {
  switch (view) {
    case "day":
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    case "week": {
      const start = startOfDay(currentDate);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      end.setMilliseconds(-1);
      return { start, end };
    }
    case "year": {
      const year = currentDate.getFullYear();
      return { start: new Date(year, 0, 1), end: new Date(year, 12, 0, 23, 59, 59, 999) };
    }
    case "month":
    default: {
      // Month grid includes leading/trailing days from adjacent months
      const days = getCalendarDays(currentDate.getFullYear(), currentDate.getMonth());
      const start = startOfDay(days[0]);
      const end = endOfDay(days[days.length - 1]);
      return { start, end };
    }
  }
}

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Single source of truth for all calendar events (raw from API), keyed to
  // the authenticated user and only enabled once authenticated.
  const { data: rawEvents = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", user?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
    enabled: !!user,
  });

  // Occurrences derived for the displayed range; re-derived when the view or
  // date changes. No timers, no remount counters.
  const events: ExpandedEvent[] = useMemo(
    () => expandRecurringEvents(rawEvents, visibleRange(view, currentDate).start, visibleRange(view, currentDate).end),
    [rawEvents, view, currentDate]
  );

  const refreshEvents = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  }, [queryClient]);

  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrev = useCallback(() => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      switch (view) {
        case "day": newDate.setDate(prevDate.getDate() - 1); break;
        case "week": newDate.setDate(prevDate.getDate() - 7); break;
        case "month": newDate.setMonth(prevDate.getMonth() - 1); break;
        case "year": newDate.setFullYear(prevDate.getFullYear() - 1); break;
      }
      return newDate;
    });
  }, [view]);
  const goToNext = useCallback(() => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      switch (view) {
        case "day": newDate.setDate(prevDate.getDate() + 1); break;
        case "week": newDate.setDate(prevDate.getDate() + 7); break;
        case "month": newDate.setMonth(prevDate.getMonth() + 1); break;
        case "year": newDate.setFullYear(prevDate.getFullYear() + 1); break;
      }
      return newDate;
    });
  }, [view]);

  const formatCurrentMonthYear = useCallback(() => {
    return formatDate(currentDate, { month: "long", year: "numeric" });
  }, [currentDate]);

  const contextValue = {
    currentDate, view, events, isLoading,
    refreshEvents,
    setCurrentDate, setView,
    goToToday, goToPrev, goToNext,
    formatCurrentMonthYear
  };

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
