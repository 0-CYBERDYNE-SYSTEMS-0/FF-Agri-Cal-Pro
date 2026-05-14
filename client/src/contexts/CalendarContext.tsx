import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
import { Event } from "@shared/schema";
import { formatDate } from "@/lib/calendarUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type CalendarViewType = "day" | "week" | "month" | "year";

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  events: Event[];
  isLoading: boolean;
  eventsRefreshTrigger: number;
  refreshEvents: () => void;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  formatCurrentMonthYear: () => string;
  forceRender: number;
}

const CalendarContext = createContext<CalendarContextType>({
  currentDate: new Date(),
  view: "month",
  events: [],
  isLoading: false,
  eventsRefreshTrigger: 0,
  refreshEvents: () => {},
  setCurrentDate: () => {},
  setView: () => {},
  goToToday: () => {},
  goToPrev: () => {},
  goToNext: () => {},
  formatCurrentMonthYear: () => "",
  forceRender: 0
});

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [forceRender, setForceRender] = useState(0);
  const [eventsRefreshTrigger, setEventsRefreshTrigger] = useState(0);
  const queryClient = useQueryClient();

  // Single source of truth for all calendar events
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events", eventsRefreshTrigger],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    },
  });

  const refreshEvents = useCallback(() => {
    setEventsRefreshTrigger(prev => prev + 1);
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  }, [queryClient]);

  const setViewAndUpdate = useCallback((newView: CalendarViewType) => {
    console.log(`Changing view from ${view} to ${newView}`);
    if (newView !== view) {
      setForceRender(prev => prev + 1);
      setTimeout(() => {
        setView(newView);
        console.log(`View updated to ${newView}, forceRender: ${forceRender + 1}`);
      }, 10);
    }
  }, [view, forceRender]);

  useEffect(() => {
    console.log("CalendarProvider view changed to:", view);
  }, [view]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

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
    eventsRefreshTrigger, refreshEvents,
    setCurrentDate, setView: setViewAndUpdate,
    goToToday, goToPrev, goToNext,
    formatCurrentMonthYear, forceRender
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
