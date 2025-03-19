import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from "react";
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
  forceRender: number;
}

// Create context with default values
const CalendarContext = createContext<CalendarContextType>({
  currentDate: new Date(),
  view: "month",
  events: [],
  isLoading: false,
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
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [forceRender, setForceRender] = useState(0);

  // Enhanced setView function with callback to ensure state updates
  const setViewAndUpdate = useCallback((newView: CalendarViewType) => {
    console.log(`Changing view from ${view} to ${newView}`);
    
    // Only update if actually changing views
    if (newView !== view) {
      // First update the forceRender counter to ensure the view change is detected
      setForceRender(prev => prev + 1);
      
      // Then update the view with a short delay to ensure state consistency
      setTimeout(() => {
        setView(newView);
        console.log(`View updated to ${newView}, forceRender: ${forceRender + 1}`);
      }, 10);
    }
  }, [view, forceRender]);

  // Log whenever view changes
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

  // Create context value object to avoid unnecessary re-renders
  const contextValue = {
    currentDate,
    view,
    events,
    isLoading,
    setCurrentDate,
    setView: setViewAndUpdate,
    goToToday,
    goToPrev,
    goToNext,
    formatCurrentMonthYear,
    forceRender
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
