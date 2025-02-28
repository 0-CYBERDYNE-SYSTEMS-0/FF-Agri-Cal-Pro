import { WeatherForecast } from "@shared/schema";
import ForecastCard from "./ForecastCard";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherRowProps {
  forecasts: WeatherForecast[];
  isLoading?: boolean;
}

export default function WeatherRow({ forecasts, isLoading = false }: WeatherRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
      {forecasts.map((forecast, index) => (
        <ForecastCard 
          key={forecast.date} 
          forecast={forecast}
          isToday={index === 0} 
        />
      ))}
    </div>
  );
}
