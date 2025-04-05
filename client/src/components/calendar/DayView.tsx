import { useQuery } from "@tanstack/react-query";
import { Event, WeatherForecast } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendar } from "@/contexts/CalendarContext";
import { formatDate, isToday, getEventsForDay } from "@/lib/calendarUtils";
import { useState } from "react";
import EventModal from "./EventModal";

function TimeSlot({ 
  hour, 
  events,
  onClick
}: { 
  hour: number;
  events: Event[];
  onClick: () => void;
}) {
  const formattedHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  
  // Get events that start within this hour
  const hourEvents = events.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate.getHours() === hour;
  });
  
  return (
    <div className="flex border-b border-neutral-200">
      <div className="w-20 text-xs text-neutral-500 pr-3 py-2 text-right border-r border-neutral-200">
        {formattedHour}
      </div>
      <div className="flex-1 p-1 min-h-[60px]" onClick={onClick}>
        {hourEvents.map(event => (
          <div 
            key={event.id} 
            className={`text-sm p-2 rounded mb-1 ${
              event.projectId === 1 
                ? "bg-primary text-white" 
                : event.projectId === 2 
                  ? "bg-secondary text-white" 
                  : "bg-accent rounded text-primary-dark"
            }`}
          >
            {event.title}
            <div className="text-xs mt-1 opacity-90">
              {formatDate(new Date(event.startDate), { hour: 'numeric', minute: '2-digit' })}
              {" - "}
              {formatDate(new Date(event.endDate), { hour: 'numeric', minute: '2-digit' })}
            </div>
            {event.location && (
              <div className="text-xs mt-1 opacity-80">
                📍 {event.location}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DayViewProps {
  weatherData?: WeatherForecast[];
}

export default function DayView({ weatherData }: DayViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const { currentDate } = useCalendar();
  
  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
  
  // Filter events for the current day
  const dayEvents = getEventsForDay(events, currentDate);
  
  const handleHourClick = (hour: number) => {
    setSelectedHour(hour);
    setIsModalOpen(true);
  };
  
  const getSelectedDate = () => {
    if (selectedHour === null) return null;
    
    const date = new Date(currentDate);
    date.setHours(selectedHour, 0, 0, 0);
    return date;
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Day header */}
        <div className="p-4 bg-neutral-50 border-b border-neutral-200">
          <h3 className="text-lg font-medium">
            {formatDate(currentDate, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h3>
          {isToday(currentDate) && (
            <div className="text-sm text-primary font-medium">Today</div>
          )}
        </div>
        
        {/* All-day events */}
        {dayEvents.filter(event => event.allDay).length > 0 && (
          <div className="p-2 border-b border-neutral-200 bg-neutral-50">
            <div className="text-xs font-medium text-neutral-500 mb-1">ALL DAY</div>
            {dayEvents
              .filter(event => event.allDay)
              .map(event => (
                <div 
                  key={event.id} 
                  className={`text-sm p-2 rounded mb-1 ${
                    event.projectId === 1 
                      ? "bg-primary text-white" 
                      : event.projectId === 2 
                        ? "bg-secondary text-white" 
                        : "bg-accent rounded text-primary-dark"
                  }`}
                >
                  {event.title}
                  {event.location && (
                    <div className="text-xs mt-1 opacity-80">
                      📍 {event.location}
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        )}
        
        {/* Hour slots */}
        <div className="overflow-y-auto max-h-[600px]">
          {hours.map(hour => (
            <TimeSlot 
              key={hour} 
              hour={hour} 
              events={dayEvents}
              onClick={() => handleHourClick(hour)}
            />
          ))}
        </div>
      </div>

      <EventModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        selectedDate={getSelectedDate()}
      />
    </>
  );
}
