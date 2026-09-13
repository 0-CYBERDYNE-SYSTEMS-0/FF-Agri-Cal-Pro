import { useCalendar } from "@/contexts/CalendarContext";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import YearView from "@/components/calendar/YearView";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { WeatherForecast } from "@shared/schema";
import WeatherRow from "@/components/weather/WeatherRow";
import ProjectCard from "@/components/project/ProjectCard";
import { useLocation } from "wouter";
import { useLocation as useLoc } from "@/contexts/LocationContext";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/use-weather";
import { useAuth } from "@/contexts/AuthContext";
import EventModal from "@/components/calendar/EventModal";

export default function Calendar() {
  const { view } = useCalendar();
  const [_, setLocation] = useLocation();
  const { requestLocationPermission, location } = useLoc();
  const [locationRequested, setLocationRequested] = useState(false);
  const { user } = useAuth();
  const [quickEventDate, setQuickEventDate] = useState<Date | null>(null);
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);

  // The header "New Event" button dispatches this custom event; the listener
  // lives here so the button works in every view, not just the month grid.
  useEffect(() => {
    const handleOpenModal = () => {
      setQuickEventDate(new Date());
      setIsQuickModalOpen(true);
    };
    window.addEventListener("open-event-modal", handleOpenModal);
    return () => window.removeEventListener("open-event-modal", handleOpenModal);
  }, []);

  const handleGetLocation = () => {
    requestLocationPermission();
    setLocationRequested(true);
  };

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user,
  });

  // Use the useWeather hook which properly handles location updates
  const { weatherData, isLoading: isLoadingWeather } = useWeather(location || undefined);

  // Render the appropriate calendar view based on the current view state
  const calendarView = (() => {
    switch (view) {
      case "day":
        return <DayView weatherData={weatherData} />;
      case "week":
        return <WeekView weatherData={weatherData} />;
      case "year":
        return <YearView weatherData={weatherData} />;
      case "month":
      default:
        return <MonthView weatherData={weatherData} />;
    }
  })();

  const handleProjectSelect = (projectId: number) => {
    setLocation(`/projects?id=${projectId}`);
  };

  // Render the projects sidebar content
  const renderProjects = () => (
    <div className="h-full">
      <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Projects</h2>
      <div className="space-y-4 max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 pb-4">
        {isLoadingProjects ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="bg-white rounded-lg shadow p-4 h-40 animate-pulse">
              <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-neutral-200 rounded w-1/4 mb-4"></div>
              <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
              <div className="h-3 bg-neutral-200 rounded w-5/6 mb-4"></div>
              <div className="h-2 bg-neutral-200 rounded w-full mt-6"></div>
            </div>
          ))
        ) : projects.length > 0 ? (
          projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onSelect={() => handleProjectSelect(project.id)}
            />
          ))
        ) : (
          <div className="text-center py-8 bg-white rounded-lg shadow">
            <p className="text-neutral-500">No projects found. Create a new project to get started.</p>
          </div>
        )}
      </div>
    </div>
  );

  // Render the weather sidebar content
  const renderWeather = () => (
    <div className="h-full">
      <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Weather Forecast</h2>
      {!locationRequested && (
        <div className="mb-4 flex justify-center">
          <Button onClick={handleGetLocation} size="sm">Get Location</Button>
        </div>
      )}
      <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 pb-2">
        <WeatherRow
          forecasts={weatherData}
          isLoading={isLoadingWeather}
          location={location}
          vertical={true} // New prop for vertical layout
        />
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left Sidebar - Projects */}
      <div className="hidden lg:block lg:w-1/5 lg:min-w-[250px] sticky top-6 self-start">
        {renderProjects()}
      </div>

      {/* Main Calendar Content */}
      <div className="flex-1">
        <CalendarHeader />
        {calendarView}
      </div>

      {/* Modal opened by the header "New Event" button in any view */}
      <EventModal
        isOpen={isQuickModalOpen}
        onClose={() => setIsQuickModalOpen(false)}
        selectedDate={quickEventDate}
      />

      {/* Right Sidebar - Weather */}
      <div className="hidden lg:block lg:w-1/5 lg:min-w-[250px] sticky top-6 self-start">
        {renderWeather()}
      </div>

      {/* Mobile View - Projects and Weather displayed below calendar */}
      <div className="lg:hidden grid grid-cols-1 gap-8 mt-8">
        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-[70vh] overflow-y-auto">
            {isLoadingProjects ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-white rounded-lg shadow p-4 h-40 animate-pulse">
                  <div className="h-4 bg-neutral-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-1/4 mb-4"></div>
                  <div className="h-3 bg-neutral-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-neutral-200 rounded w-5/6 mb-4"></div>
                  <div className="h-2 bg-neutral-200 rounded w-full mt-6"></div>
                </div>
              ))
            ) : projects.length > 0 ? (
              projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onSelect={() => handleProjectSelect(project.id)}
                />
              ))
            ) : (
              <div className="col-span-3 text-center py-8 bg-white rounded-lg shadow">
                <p className="text-neutral-500">No projects found. Create a new project to get started.</p>
              </div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Weather Forecast</h2>
          {!locationRequested && (
            <div className="mb-4 flex justify-center">
              <Button onClick={handleGetLocation}>Get Location</Button>
            </div>
          )}
          <div className="max-h-[70vh] overflow-y-auto pr-2 pb-2">
            <WeatherRow
              forecasts={weatherData}
              isLoading={isLoadingWeather}
              location={location}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
