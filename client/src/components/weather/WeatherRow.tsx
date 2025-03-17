import { WeatherForecast } from "@shared/schema";
import ForecastCard from "./ForecastCard";
import { Skeleton } from "@/components/ui/skeleton";
import { getLocationName } from "@/lib/openWeatherApi";

interface WeatherRowProps {
  forecasts: WeatherForecast[];
  isLoading?: boolean;
  location?: string | null;
}

export default function WeatherRow({ forecasts, isLoading = false, location = null }: WeatherRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  const displayLocation = getLocationName(location || "default");
  
  return (
    <>
      <h3 className="text-center text-lg font-semibold mb-2">{`Weather in ${displayLocation}`}</h3>
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {forecasts.map((forecast, index) => (
          <ForecastCard 
            key={`${forecast.date}-${index}`} 
            forecast={forecast}
            isToday={index === 0} 
          />
        ))}
      </div>
    </>
  );
}
