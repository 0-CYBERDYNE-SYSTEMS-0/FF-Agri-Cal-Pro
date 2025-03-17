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

export default function Calendar() {
  const { view } = useCalendar();
  const [_, setLocation] = useLocation();
  const { requestLocationPermission, location } = useLoc();
  const [locationRequested, setLocationRequested] = useState(false);

  // useEffect(() => {
  //   requestLocationPermission();
  // }, []);

  const handleGetLocation = () => {
    requestLocationPermission();
    setLocationRequested(true);
  };

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Use the useWeather hook which properly handles location updates
  const { weatherData, isLoading: isLoadingWeather } = useWeather(location || undefined);

  // Render the appropriate calendar view based on the current view state
  const renderCalendarView = () => {
    switch (view) {
      case "day":
        return <DayView />;
      case "week":
        return <WeekView />;
      case "year":
        return <YearView />;
      case "month":
      default:
        return <MonthView weatherData={weatherData} />;
    }
  };

  const handleProjectSelect = (projectId: number) => {
    setLocation(`/projects?id=${projectId}`);
  };

  // Get active projects only (limit to 3 for display)
  const activeProjects = projects
    .filter(project => project.status === "active" || project.status === "ongoing")
    .slice(0, 3);

  return (
    <>
      <CalendarHeader />
      
      {renderCalendarView()}

      {!locationRequested && (
        <div className="mt-4 flex justify-center">
          <Button onClick={handleGetLocation}>Get Location</Button>
        </div>
      )}
      
      {/* Weather Forecast Section */}
      <div className="mt-8">
        <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Weather Forecast</h2>
        <WeatherRow 
          forecasts={weatherData} 
          isLoading={isLoadingWeather}
          location={location}
        />
      </div>
      
      {/* Current Projects Quick Access */}
      <div className="mt-8">
        <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Active Projects</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          ) : activeProjects.length > 0 ? (
            activeProjects.map((project) => (
              <ProjectCard 
                key={project.id} 
                project={project} 
                onSelect={() => handleProjectSelect(project.id)}
              />
            ))
          ) : (
            <div className="col-span-3 text-center py-8 bg-white rounded-lg shadow">
              <p className="text-neutral-500">No active projects found. Create a new project to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
