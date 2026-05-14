import { useQuery } from "@tanstack/react-query";
import { WeatherForecast } from "@shared/schema";
import { ExpandedEvent } from "@/lib/calendarUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { useCalendar } from "@/contexts/CalendarContext";
import { 
  formatDate, 
  isSameMonth, 
  isToday, 
  getMonthDays, 
  getEventsForMonth 
} from "@/lib/calendarUtils";
import { useState } from "react";

function MonthCard({ 
  month, 
  year, 
  currentMonth, 
  currentYear,
  events,
  onMonthClick
}: { 
  month: number; 
  year: number;
  currentMonth: number;
  currentYear: number;
  events: ExpandedEvent[];
  onMonthClick: () => void;
}) {
  const monthDays = getMonthDays(year, month);
  const monthEvents = getEventsForMonth(events, year, month);
  const hasEvents = monthEvents.length > 0;
  const isCurrentMonth = month === currentMonth && year === currentYear;

  // Get the number of days in each weekday (to generate the mini calendar grid)
  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  
  // Get the first day of the month (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  // Create array for all days in the month plus empty spots for days from previous/next month
  const calendarDays = Array(42).fill(null);
  
  monthDays.forEach((day, index) => {
    calendarDays[firstDayOfMonth + index] = day;
  });

  return (
    <div 
      className={`bg-white rounded-lg shadow p-3 ${isCurrentMonth ? 'ring-2 ring-primary' : ''}`}
      onClick={onMonthClick}
    >
      <h3 className={`text-center font-medium mb-2 ${isCurrentMonth ? 'text-primary' : 'text-neutral-700'}`}>
        {formatDate(new Date(year, month, 1), { month: 'short' })}
      </h3>
      
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {daysOfWeek.map((day, i) => (
          <div key={i} className="text-neutral-500">{day}</div>
        ))}
        
        {calendarDays.map((day, i) => {
          if (!day) return <div key={i}></div>;
          
          const isToday_ = isToday(day);
          
          return (
            <div 
              key={i} 
              className={`rounded-full w-5 h-5 mx-auto flex items-center justify-center text-[10px] ${
                isToday_ ? 'bg-primary text-white' : ''
              }`}
            >
              {day.getDate()}
            </div>
          );
        })}
      </div>
      
      {hasEvents && (
        <div className="mt-2 text-xs text-center text-primary">
          {monthEvents.length} event{monthEvents.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}

interface YearViewProps {
  weatherData?: WeatherForecast[];
}

export default function YearView({ weatherData }: YearViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { currentDate, events, isLoading, setView, setCurrentDate } = useCalendar();

  const year = currentDate.getFullYear();
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const months = Array.from({ length: 12 }, (_, i) => i);
  
  const handleMonthClick = (month: number) => {
    const newDate = new Date(year, month, 1);
    setCurrentDate(newDate);
    setView("month");
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-medium mb-4 text-center">{year}</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {months.map(month => (
          <MonthCard 
            key={month} 
            month={month} 
            year={year}
            currentMonth={currentMonth}
            currentYear={currentYear}
            events={events}
            onMonthClick={() => handleMonthClick(month)}
          />
        ))}
      </div>
    </div>
  );
}
