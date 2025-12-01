import { useCalendar } from "@/contexts/CalendarContext";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";
import YearView from "@/components/calendar/YearView";
import ViewDebugger from "@/components/calendar/ViewDebugger";
import { useQuery } from "@tanstack/react-query";
import { Project } from "@shared/schema";
import { WeatherForecast } from "@shared/schema";
import WeatherRow from "@/components/weather/WeatherRow";
import ProjectCard from "@/components/project/ProjectCard";
import { useLocation } from "wouter";
import { useLocation as useLoc } from "@/contexts/LocationContext";
import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useWeather } from "@/hooks/use-weather";

export default function Calendar() {
  const { view, forceRender } = useCalendar();
  const [_, setLocation] = useLocation();
  const { requestLocationPermission, location, isLoading: isLocationLoading, error: locationError, hasRequestedPermission, setLocation: setUserLocation } = useLoc();
  const [lastRenderedView, setLastRenderedView] = useState(view);
  const [manualLocationInput, setManualLocationInput] = useState(location || "");

  // Log view changes for debugging
  useEffect(() => {
    console.log("Current calendar view:", view);
    // Update the last rendered view to track changes
    setLastRenderedView(view);
  }, [view, forceRender]);

  const handleGetLocation = () => {
    requestLocationPermission();
  };

  const handleManualLocationSave = async () => {
    const trimmed = manualLocationInput.trim();
    if (!trimmed) return;
    await setUserLocation(trimmed);
  };

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Use the useWeather hook which properly handles location updates
  const { weatherData, isLoading: isLoadingWeather, resolvedLocationName } = useWeather(location || undefined);

  // Render the appropriate calendar view based on the current view state
  // Using useMemo to ensure the view only re-renders when necessary
  const calendarView = useMemo(() => {
    console.log("Rendering view:", view, "forceRender:", forceRender);
    
    switch (view) {
      case "day":
        return <DayView key={`day-view-${forceRender}`} weatherData={weatherData} />;
      case "week":
        return <WeekView key={`week-view-${forceRender}`} weatherData={weatherData} />;
      case "year":
        return <YearView key={`year-view-${forceRender}`} weatherData={weatherData} />;
      case "month":
      default:
        return <MonthView key={`month-view-${forceRender}`} weatherData={weatherData} />;
    }
  }, [view, weatherData, forceRender]);

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
      <div className="mb-4 flex flex-col items-center">
        <Button
          onClick={handleGetLocation}
          size="sm"
          disabled={isLocationLoading}
        >
          {isLocationLoading
            ? "Getting Location..."
            : hasRequestedPermission
              ? "Retry Location"
              : "Get Location"}
        </Button>
        {locationError && (
          <p className="mt-2 text-xs text-red-500 text-center">
            {locationError}
          </p>
        )}
        <div className="mt-3 w-full px-2">
          <input
            type="text"
            value={manualLocationInput}
            onChange={(e) => setManualLocationInput(e.target.value)}
            placeholder="Enter city, town, or lat,lon"
            className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={handleManualLocationSave}
            className="mt-2 w-full rounded bg-primary px-2 py-1 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            disabled={isLocationLoading}
          >
            Use This Location
          </button>
        </div>
      </div>
      <div className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-2 pb-2">
        <WeatherRow 
          forecasts={weatherData} 
          isLoading={isLoadingWeather}
          location={location}
          resolvedLocationName={resolvedLocationName}
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
        <ViewDebugger />
      </div>
      
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
          <div className="mb-4 flex flex-col items-center">
            <Button
              onClick={handleGetLocation}
              disabled={isLocationLoading}
            >
              {isLocationLoading
                ? "Getting Location..."
                : hasRequestedPermission
                  ? "Retry Location"
                  : "Get Location"}
            </Button>
            {locationError && (
              <p className="mt-2 text-xs text-red-500 text-center">
                {locationError}
              </p>
            )}
            <div className="mt-3 w-full px-2">
              <input
                type="text"
                value={manualLocationInput}
                onChange={(e) => setManualLocationInput(e.target.value)}
                placeholder="Enter city, town, or lat,lon"
                className="w-full rounded border border-neutral-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="button"
                onClick={handleManualLocationSave}
                className="mt-2 w-full rounded bg-primary px-2 py-1 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                disabled={isLocationLoading}
              >
                Use This Location
              </button>
            </div>
          </div>
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
