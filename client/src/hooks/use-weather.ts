import { useState, useEffect } from "react";
import { WeatherForecast } from "@shared/schema";
import { getWeatherForecast } from "@/lib/openWeatherApi";

export function useWeather(location?: string) {
  const [weatherData, setWeatherData] = useState<WeatherForecast[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchWeatherData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Try to get user's saved location if none provided
        if (!location) {
          const savedLocation = localStorage.getItem("userLocation");
          location = savedLocation || undefined;
        }
        
        const data = await getWeatherForecast(location);
        setWeatherData(data);
      } catch (err) {
        console.error("Error fetching weather data:", err);
        setError("Failed to load weather data");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchWeatherData();
  }, [location]);
  
  return { weatherData, isLoading, error };
}