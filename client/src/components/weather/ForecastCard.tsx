import { WeatherForecast } from "@shared/schema";
import { getWeatherIcon, getWeatherDescription, getWeatherRecommendation, shouldShowWeatherWarning, getWeatherWarning } from "@/lib/openWeatherApi";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ForecastCardProps {
  forecast: WeatherForecast;
  isToday?: boolean;
  compact?: boolean;
}

export default function ForecastCard({ forecast, isToday = false, compact = false }: ForecastCardProps) {
  const { dayOfWeek, temperature, weatherDescription, icon, wind, humidity, precipitation } = forecast;
  const showWarning = shouldShowWeatherWarning(forecast);
  
  // Different layout for compact (vertical sidebar) mode
  if (compact) {
    return (
      <Card className="shadow">
        <CardContent className="p-3">
          <div className="flex items-center">
            <div className="mr-3 text-2xl">{getWeatherIcon(icon)}</div>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <p className="font-medium text-neutral-700">{isToday ? "Today" : dayOfWeek}</p>
                <p className="text-base font-medium">{temperature}°F</p>
              </div>
              <p className="text-xs text-neutral-500">{getWeatherDescription(weatherDescription)}</p>
              
              <div className="mt-1 text-xs text-neutral-500 flex justify-between">
                <span>Wind: {wind}mph</span>
                <span>Hum: {humidity}%</span>
              </div>
            </div>
          </div>
          
          {showWarning && (
            <div className="mt-1 p-1 text-xs bg-red-100 text-red-800 rounded text-center">
              Weather Alert: {getWeatherWarning(forecast)}
            </div>
          )}
          
          {isToday && (
            <div className="mt-1 p-1 text-xs bg-primary/10 text-primary-dark rounded text-center">
              {getWeatherRecommendation(forecast)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Regular card layout (original)
  return (
    <Card className="shadow">
      <CardContent className="p-4 text-center">
        <p className="font-medium text-neutral-700">{isToday ? "Today" : dayOfWeek}</p>
        <div className="my-2 text-4xl">{getWeatherIcon(icon)}</div>
        <p className="text-lg font-medium">{temperature}°F</p>
        <p className="text-sm text-neutral-500">{getWeatherDescription(weatherDescription)}</p>
        
        <div className="mt-2 text-xs text-neutral-600 space-y-1">
          <div className="flex justify-between items-center">
            <span>Wind</span>
            <span>{wind} mph</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Humidity</span>
            <span>{humidity}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Precip</span>
            <span>{precipitation}%</span>
          </div>
        </div>
        
        {showWarning && (
          <div className="mt-2 p-1 text-xs bg-red-100 text-red-800 rounded">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Weather Alert
                </div>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{getWeatherWarning(forecast)}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
        
        {isToday && (
          <div className="mt-2 p-1 text-xs bg-primary/10 text-primary-dark rounded">
            {getWeatherRecommendation(forecast)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
