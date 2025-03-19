import { useState, useEffect } from "react";
import { WeatherForecast } from "@shared/schema";
import { getWeatherForecast } from "@/lib/openWeatherApi";
import { useQuery } from "@tanstack/react-query";

export function useWeather(location?: string) {
  // Get an effective location to use
  const getEffectiveLocation = () => {
    if (location) return location;
    
    // Try to get user's saved location if none provided
    const savedLocation = localStorage.getItem("userLocation");
    return savedLocation || "New York"; // Default to New York if no location available
  };
  
  // Use React Query for better caching and stale-while-revalidate behavior
  const { data: weatherData = [], isLoading, error } = useQuery<WeatherForecast[]>({
    queryKey: ['weather', getEffectiveLocation()],
    queryFn: async () => {
      try {
        return await getWeatherForecast(getEffectiveLocation());
      } catch (err) {
        console.error("Error fetching weather data:", err);
        throw err;
      }
    },
    staleTime: 10 * 60 * 1000, // Consider data fresh for 10 minutes
    gcTime: 15 * 60 * 1000,    // Keep unused data in cache for 15 minutes
    retry: 2,                  // Retry failed requests twice
  });
  
  return { 
    weatherData, 
    isLoading, 
    error: error ? (error as Error).message : null 
  };
}