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
      <div className={vertical 
        ? "flex flex-col gap-4" 
        : "grid grid-cols-1 md:grid-cols-7 gap-4"
      }>
        {Array.from({ length: vertical ? 5 : 7 }).map((_, i) => (
          <Skeleton key={i} className={vertical ? "h-24 w-full" : "h-48 w-full"} />
        ))}
      </div>
    );
  }

  const displayLocation = getLocationName(location || "default");
  
  // In vertical mode, limit to 5 days instead of 7
  const displayedForecasts = vertical ? forecasts.slice(0, 5) : forecasts;
  
  return (
    <>
      <h3 className="text-center text-lg font-semibold mb-2">{`Weather in ${displayLocation}`}</h3>
      <div className={vertical 
        ? "flex flex-col gap-3" 
        : "grid grid-cols-1 md:grid-cols-7 gap-4"
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
    </>
  );
}
