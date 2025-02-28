import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { Event } from "@shared/schema";
import { formatDate } from "@/lib/calendarUtils";

type CalendarViewType = "day" | "week" | "month" | "year";

interface CalendarContextType {
  currentDate: Date;
  view: CalendarViewType;
  events: Event[];
  isLoading: boolean;
  setCurrentDate: (date: Date) => void;
  setView: (view: CalendarViewType) => void;
  goToToday: () => void;
  goToPrev: () => void;
  goToNext: () => void;
  formatCurrentMonthYear: () => string;
}

const CalendarContext = createContext<CalendarContextType | undefined>(undefined);

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarViewType>("month");
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const goToPrev = useCallback(() => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      
      switch (view) {
        case "day":
          newDate.setDate(prevDate.getDate() - 1);
          break;
        case "week":
          newDate.setDate(prevDate.getDate() - 7);
          break;
        case "month":
          newDate.setMonth(prevDate.getMonth() - 1);
          break;
        case "year":
          newDate.setFullYear(prevDate.getFullYear() - 1);
          break;
      }
      
      return newDate;
    });
  }, [view]);

  const goToNext = useCallback(() => {
    setCurrentDate(prevDate => {
      const newDate = new Date(prevDate);
      
      switch (view) {
        case "day":
          newDate.setDate(prevDate.getDate() + 1);
          break;
        case "week":
          newDate.setDate(prevDate.getDate() + 7);
          break;
        case "month":
          newDate.setMonth(prevDate.getMonth() + 1);
          break;
        case "year":
          newDate.setFullYear(prevDate.getFullYear() + 1);
          break;
      }
      
      return newDate;
    });
  }, [view]);

  const formatCurrentMonthYear = useCallback(() => {
    return formatDate(currentDate, { month: "long", year: "numeric" });
  }, [currentDate]);

  return (
    <CalendarContext.Provider
      value={{
        currentDate,
        view,
        events,
        isLoading,
        setCurrentDate,
        setView,
        goToToday,
        goToPrev,
        goToNext,
        formatCurrentMonthYear
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (context === undefined) {
    throw new Error("useCalendar must be used within a CalendarProvider");
  }
  return context;
}
