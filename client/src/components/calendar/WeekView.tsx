import { useQuery } from "@tanstack/react-query";
import { WeatherForecast } from "@shared/schema";
import { ExpandedEvent } from "@/lib/calendarUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendar } from "@/contexts/CalendarContext";
import { formatDate, isToday, getEventsForDay } from "@/lib/calendarUtils";
import { useState } from "react";
import EventModal from "./EventModal";

function TimeSlot({ time }: { time: string }) {
  return <div className="text-xs text-neutral-500 pr-2 py-2 text-right">{time}</div>;
}

function HourRow({ 
  hour, 
  days, 
  events,
  onCellClick
}: { 
  hour: number; 
  days: Date[];
  events: ExpandedEvent[];
  onCellClick: (date: Date) => void;
}) {
  const formattedHour = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  
  return (
    <div className="grid grid-cols-8 border-b border-neutral-200">
      <TimeSlot time={formattedHour} />
      {days.map((day, index) => {
        // Create a new date object for this hour on this day
        const dateForHour = new Date(day);
        dateForHour.setHours(hour, 0, 0, 0);
        
        // Get events that start within this hour
        const hourEvents = events.filter(event => {
          const eventDate = new Date(event.startDate);
          return eventDate.getDate() === day.getDate() && 
                 eventDate.getMonth() === day.getMonth() && 
                 eventDate.getHours() === hour;
        });
        
        return (
          <div 
            key={index} 
            className={`border-l border-neutral-200 p-1 min-h-[60px] ${isToday(day) ? 'bg-accent-light/20' : ''}`}
            onClick={() => onCellClick(dateForHour)}
          >
            {hourEvents.map(event => (
              <div 
                key={event.id} 
                className={`text-xs p-1 rounded mb-1 overflow-hidden ${
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
      })}
    </div>
  );
}

interface WeekViewProps {
  weatherData?: WeatherForecast[];
}

export default function WeekView({ weatherData }: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { currentDate, events, isLoading } = useCalendar();

  // Generate week days starting from Sunday
  const generateWeekDays = (date: Date): Date[] => {
    const days: Date[] = [];
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Get the first day of the week (Sunday)
    const firstDay = new Date(date);
    firstDay.setDate(date.getDate() - dayOfWeek);
    
    // Generate 7 days
    for (let i = 0; i < 7; i++) {
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + i);
      days.push(day);
    }
    
    return days;
  };
  
  const weekDays = generateWeekDays(currentDate);
  const hours = Array.from({ length: 24 }, (_, i) => i); // 0-23 hours
  
  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <Skeleton className="h-[600px] w-full" />;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Week header */}
        <div className="grid grid-cols-8 border-b border-neutral-200 bg-neutral-50">
          <div className="p-2"></div> {/* Empty corner cell */}
          {weekDays.map((day, index) => (
            <div 
              key={index} 
              className={`p-2 text-center border-l border-neutral-200 ${
                isToday(day) ? 'bg-accent-light/30 font-bold text-primary' : ''
              }`}
            >
              <div className="font-medium">{formatDate(day, { weekday: 'short' })}</div>
              <div className={`text-sm ${isToday(day) ? 'text-primary' : 'text-neutral-500'}`}>
                {day.getDate()}
              </div>
            </div>
          ))}
        </div>
        
        {/* Hour rows */}
        <div className="overflow-y-auto max-h-[600px]">
          {hours.map(hour => (
            <HourRow 
              key={hour} 
              hour={hour} 
              days={weekDays} 
              events={events}
              onCellClick={handleCellClick}
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
