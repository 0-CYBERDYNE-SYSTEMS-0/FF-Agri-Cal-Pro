import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useCalendar } from "@/contexts/CalendarContext";
import EventModal from "./EventModal";

type ViewButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function ViewButton({ label, isActive, onClick }: ViewButtonProps) {
  return (
    <button
      className={`px-4 py-2 border-r border-neutral-200 ${
        isActive ? "text-primary font-medium" : "text-neutral-600 hover:text-primary transition"
      }`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export default function CalendarHeader() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { view, setView, currentDate, formatCurrentMonthYear, goToPrev, goToNext, goToToday } = useCalendar();

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-serif font-bold text-neutral-900">Calendar</h1>
            <p className="text-neutral-500">{formatCurrentMonthYear()}</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex bg-white rounded-md shadow-sm">
              <ViewButton 
                label="Day" 
                isActive={view === "day"} 
                onClick={() => setView("day")} 
              />
              <ViewButton 
                label="Week" 
                isActive={view === "week"} 
                onClick={() => setView("week")} 
              />
              <ViewButton 
                label="Month" 
                isActive={view === "month"} 
                onClick={() => setView("month")} 
              />
              <ViewButton 
                label="Year" 
                isActive={view === "year"} 
                onClick={() => setView("year")} 
              />
            </div>
            <Button onClick={() => setIsModalOpen(true)} className="bg-primary hover:bg-primary-dark">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              New Event
            </Button>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-2">
            <button 
              className="p-2 rounded-full hover:bg-neutral-200 transition"
              onClick={goToPrev}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <h2 className="text-xl font-medium">
              {formatCurrentMonthYear()}
            </h2>
            <button 
              className="p-2 rounded-full hover:bg-neutral-200 transition"
              onClick={goToNext}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-neutral-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <button 
            className="px-3 py-1 text-sm bg-white rounded-md shadow-sm border border-neutral-200 hover:bg-neutral-50 transition"
            onClick={goToToday}
          >
            Today
          </button>
        </div>
      </div>

      <EventModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
