import {
  getCalendarDays,
  isSameMonth,
  isToday,
  getEventsForDay,
} from "@/lib/calendarUtils";
import { useState, useEffect } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import { Event, WeatherForecast } from "@shared/schema";
import EventModal from "./EventModal";
import { Skeleton } from "@/components/ui/skeleton";
import { getProjectColor } from "@/lib/colorUtils";

interface CalendarDayProps {
  day: Date;
  currentMonth: number;
  events: Event[];
  weatherData: WeatherForecast[] | undefined;
  onClick: () => void;
  onEventClick: (eventId: number) => void;
}

function CalendarDay({
  day,
  currentMonth,
  events,
  weatherData,
  onClick,
  onEventClick,
}: CalendarDayProps) {
  const isCurrentMonth = isSameMonth(
    day,
    new Date(new Date().getFullYear(), currentMonth)
  );
  const isTodayDate = isToday(day);
  const dayEvents = getEventsForDay(events, day);
  const hasEvents = dayEvents.length > 0;

  // Find weather data for this day if available
  const weather = weatherData?.find((forecast) => {
    const forecastDate = new Date(forecast.date);
    return (
      forecastDate.getDate() === day.getDate() &&
      forecastDate.getMonth() === day.getMonth() &&
      forecastDate.getFullYear() === day.getFullYear()
    );
  });

  return (
    <div
      className={`bg-white p-2 h-32 overflow-y-auto calendar-day ${
        !isCurrentMonth ? "text-neutral-400" : ""
      } ${isTodayDate ? "today bg-accent-light font-bold text-primary" : ""} ${
        hasEvents ? "has-event" : ""
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-center">
        <div className="text-xs">
          {weather && (
            <span
              title={`${weather.temperature}°F - ${weather.weatherDescription}`}
            >
              {weather.icon}
            </span>
          )}
        </div>
        <div>{day.getDate()}</div>
      </div>

      {dayEvents.map((event) => {
        // Handle case where projectId might be null or undefined
        const projectColor = getProjectColor(event.projectId || undefined);
        return (
          <div
            key={event.id}
            className={`mt-1 px-2 py-1 text-xs rounded-md cursor-pointer hover:opacity-90 flex items-center shadow-sm border border-l-4 ${projectColor.border} bg-white`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent day click
              onEventClick(event.id);
            }}
          >
            <span className={`w-2 h-2 rounded-full ${projectColor.bg} mr-1.5 flex-shrink-0`}></span>
            <span className="line-clamp-1 text-neutral-800">{event.title}</span>
          </div>
        );
      })}
    </div>
  );
}

interface MonthViewProps {
    weatherData: WeatherForecast[] | undefined;
}

export default function MonthView({ weatherData }: MonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | undefined>(undefined);
  const { currentDate, events, isLoading } = useCalendar();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calendarDays = getCalendarDays(year, month);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setSelectedEventId(undefined); // Clear event ID when just selecting a day
    setIsModalOpen(true);
  };

  const handleEventClick = (eventId: number) => {
    const clickedEvent = events.find(event => event.id === eventId);
    if (clickedEvent) {
      setSelectedDate(new Date(clickedEvent.startDate));
      setSelectedEventId(eventId);
      setIsModalOpen(true);
    }
  };

  // Listen for custom events to open the modal from elsewhere
  useEffect(() => {
    const handleOpenModal = () => {
      console.log("Received open-event-modal event");
      setSelectedDate(new Date());
      setSelectedEventId(undefined);
      setIsModalOpen(true);
    };

    window.addEventListener('open-event-modal', handleOpenModal);
    
    return () => {
      window.removeEventListener('open-event-modal', handleOpenModal);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-7 gap-px bg-neutral-200">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={`header-${i}`}
            className="bg-white p-2 text-center text-sm font-medium text-neutral-600"
          >
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][i]}
          </div>
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={`cell-${i}`} className="bg-white p-2 h-32">
            <Skeleton className="h-4 w-8 ml-auto" />
            <Skeleton className="h-4 w-full mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Calendar Days Header */}
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, i) => (
            <div key={i} className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-neutral-200">
          {calendarDays.map((day, index) => (
            <CalendarDay
              key={index}
              day={day}
              currentMonth={month}
              events={events}
              weatherData={weatherData}
              onClick={() => handleDayClick(day)}
              onEventClick={handleEventClick}
            />
          ))}
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedEventId(undefined);
        }}
        selectedDate={selectedDate}
        editEventId={selectedEventId}
      />
    </>
  );
}
