import { useQuery } from "@tanstack/react-query";
import { Event, WeatherForecast } from "@shared/schema";
import {
  getCalendarDays,
  isSameMonth,
  isToday,
  getEventsForDay,
} from "@/lib/calendarUtils";
import { useState } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import EventModal from "./EventModal";
import { Skeleton } from "@/components/ui/skeleton";

interface CalendarDayProps {
  day: Date;
  currentMonth: number;
  events: Event[];
  weatherData: WeatherForecast[] | undefined;
  onClick: () => void;
}

function CalendarDay({
  day,
  currentMonth,
  events,
  weatherData,
  onClick,
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

      {dayEvents.map((event) => (
        <div
          key={event.id}
          className={`mt-1 px-1 py-0.5 text-xs rounded ${
            event.projectId === 1
              ? "bg-primary text-white"
              : event.projectId === 2
              ? "bg-secondary text-white"
              : "bg-accent rounded text-primary-dark"
          }`}
        >
          {event.title}
        </div>
      ))}
    </div>
  );
}

interface MonthViewProps {
    weatherData: WeatherForecast[] | undefined;
}

export default function MonthView({ weatherData }: MonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentDate } = useCalendar();

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const calendarDays = getCalendarDays(year, month);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setIsModalOpen(true);
  };

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
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Sun
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Mon
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Tue
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Wed
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Thu
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Fri
          </div>
          <div className="bg-white p-2 text-center text-sm font-medium text-neutral-600">
            Sat
          </div>
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
            />
          ))}
        </div>
      </div>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
      />
    </>
  );
}
