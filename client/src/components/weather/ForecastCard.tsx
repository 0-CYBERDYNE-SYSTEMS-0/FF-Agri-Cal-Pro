import { WeatherForecast } from "@shared/schema";
import { getWeatherIcon, getWeatherDescription, getWeatherRecommendation, shouldShowWeatherWarning, getWeatherWarning } from "@/lib/openWeatherApi";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ForecastCardProps {
  forecast: WeatherForecast;
  isToday?: boolean;
  compact?: boolean;
  isCurrent?: boolean;
}

export default function ForecastCard({ forecast, isToday = false, compact = false, isCurrent = false }: ForecastCardProps) {
  const { 
    dayOfWeek, 
    temperature, 
    temp_min, 
    temp_max, 
    feels_like,
    weatherDescription, 
    icon, 
    wind, 
    humidity, 
    precipitation,
    pressure,
    visibility,
    uv_index
  } = forecast;

  const showWarning = shouldShowWeatherWarning(forecast);
  
  // Special card for current weather conditions (larger, more detailed)
  if (isCurrent) {
    return (
      <Card className="shadow bg-gradient-to-b from-primary-50 to-white">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-primary">Current Conditions</h3>
            <span className="text-xs bg-primary/10 px-2 py-1 rounded-full text-primary">Now</span>
          </div>
          
          <div className="flex items-center mb-4">
            <div className="text-6xl mr-4">{getWeatherIcon(icon)}</div>
            <div>
              <div className="flex items-end">
                <span className="text-4xl font-medium">{Math.round(temperature)}°</span>
                <span className="text-lg text-neutral-500 ml-2">F</span>
              </div>
              <p className="text-neutral-700">{getWeatherDescription(weatherDescription)}</p>
              <p className="text-sm text-neutral-500">Feels like {Math.round(feels_like || temperature)}°</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-neutral-500">High</div>
                <div className="font-medium">{Math.round(temp_max || temperature)}°F</div>
                
                <div className="text-neutral-500">Low</div>
                <div className="font-medium">{Math.round(temp_min || temperature)}°F</div>
                
                <div className="text-neutral-500">Wind</div>
                <div className="font-medium">{wind} mph</div>
                
                <div className="text-neutral-500">Humidity</div>
                <div className="font-medium">{humidity}%</div>
              </div>
            </div>
            
            <div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-neutral-500">Precip</div>
                <div className="font-medium">{precipitation}%</div>
                
                {pressure && (
                  <>
                    <div className="text-neutral-500">Pressure</div>
                    <div className="font-medium">{pressure} hPa</div>
                  </>
                )}
                
                {visibility && (
                  <>
                    <div className="text-neutral-500">Visibility</div>
                    <div className="font-medium">{(visibility / 1000).toFixed(1)} km</div>
                  </>
                )}
                
                {uv_index && (
                  <>
                    <div className="text-neutral-500">UV Index</div>
                    <div className="font-medium">{uv_index}</div>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {showWarning && (
            <div className="mt-4 p-2 text-sm bg-red-100 text-red-800 rounded">
              <div className="flex items-center font-medium mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Weather Alert
              </div>
              <p>{getWeatherWarning(forecast)}</p>
            </div>
          )}
          
          <div className="mt-4 p-2 text-sm bg-primary/10 text-primary-dark rounded">
            <div className="font-medium mb-1">Agricultural Recommendation</div>
            <p>{getWeatherRecommendation(forecast)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
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
                <p className="text-base font-medium">{Math.round(temperature)}°F</p>
              </div>
              <p className="text-xs text-neutral-500">{getWeatherDescription(weatherDescription)}</p>
              
              <div className="mt-1 text-xs text-neutral-500">
                <div className="flex justify-between">
                  <span>Wind: {wind}mph</span>
                  <span>Hum: {humidity}%</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-blue-500">↓ {Math.round(temp_min || temperature)}°</span>
                  <span className="text-red-500">↑ {Math.round(temp_max || temperature)}°</span>
                </div>
              </div>
            </div>
          </div>
          
          {showWarning && (
            <div className="mt-2 p-1.5 text-xs bg-red-100 text-red-800 rounded-md font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {getWeatherWarning(forecast)}
            </div>
          )}
          
          {/* Only show recommendations for today */}
          {isToday && (
            <div className="mt-2 p-1.5 text-xs bg-primary/10 text-primary-dark rounded-md">
              {getWeatherRecommendation(forecast)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
  
  // Regular card layout (with high/low temps)
  return (
    <Card className="shadow">
      <CardContent className="p-4 text-center">
        <p className="font-medium text-neutral-700">{isToday ? "Today" : dayOfWeek}</p>
        <div className="my-2 text-4xl">{getWeatherIcon(icon)}</div>
        <p className="text-lg font-medium">{Math.round(temperature)}°F</p>
        <p className="text-sm text-neutral-500">{getWeatherDescription(weatherDescription)}</p>
        
        <div className="flex justify-between px-2 mt-2 mb-3">
          <span className="text-sm text-blue-500">↓ {Math.round(temp_min || temperature)}°</span>
          <span className="text-sm text-red-500">↑ {Math.round(temp_max || temperature)}°</span>
        </div>
        
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
