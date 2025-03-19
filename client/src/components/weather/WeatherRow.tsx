import { WeatherForecast } from "@shared/schema";
import ForecastCard from "./ForecastCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocationName } from "@/lib/openWeatherApi";

interface WeatherRowProps {
  forecasts: WeatherForecast[];
  isLoading?: boolean;
  location?: string | null;
  vertical?: boolean;
}

export default function WeatherRow({ forecasts, isLoading = false, location = null, vertical = false }: WeatherRowProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Current conditions skeleton */}
        <Skeleton className="h-64 w-full" />
        
        {/* Forecast skeletons */}
        <div className={vertical 
          ? "flex flex-col gap-4" 
          : "grid grid-cols-1 md:grid-cols-7 gap-4"
        }>
          {Array.from({ length: vertical ? 5 : 7 }).map((_, i) => (
            <Skeleton key={i} className={vertical ? "h-24 w-full" : "h-48 w-full"} />
          ))}
        </div>
      </div>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="text-center py-8 bg-white rounded-lg shadow">
        <p className="text-neutral-500">No weather data available. Please check your location settings.</p>
      </div>
    );
  }

  const displayLocation = getLocationName(location || "default");
  
  // Make a copy of the first forecast with isCurrent flag for the current conditions card
  const currentForecast = { ...forecasts[0], isCurrent: true };
  
  // In vertical mode, show 5 days of forecast
  const displayedForecasts = vertical 
    ? forecasts.slice(1, 6) // Skip first day (shown as current) and show next 5
    : forecasts.slice(1);   // Skip first day (shown as current) and show all others
  
  return (
    <div className="space-y-6">
      {/* Current Conditions */}
      <div>
        <h3 className="text-center text-lg font-semibold mb-2">{`Weather in ${displayLocation}`}</h3>
        
        {/* Current Conditions Card */}
        <div className="mb-6">
          <ForecastCard 
            forecast={currentForecast}
            isToday={true}
            isCurrent={true}
          />
        </div>
        
        {/* Daily Forecast Section */}
        <h4 className="text-md font-semibold mb-2">Forecast</h4>
        <div className={vertical 
          ? "flex flex-col gap-4" 
          : "grid grid-cols-1 md:grid-cols-6 gap-4"
        }>
          {displayedForecasts.map((forecast, index) => (
            <ForecastCard 
              key={`${forecast.date}-${index}`} 
              forecast={forecast}
              isToday={index === 0}
              compact={vertical}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
