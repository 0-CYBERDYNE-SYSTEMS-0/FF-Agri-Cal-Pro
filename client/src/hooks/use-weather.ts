import { WeatherForecast } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export function useWeather(location?: string) {
  // Get an effective location to use
  const getEffectiveLocation = () => {
    if (location && location.trim()) return location.trim();
    
    // Try to get user's saved location if none provided
    const savedLocation = localStorage.getItem("userLocation");
    if (savedLocation && savedLocation.trim()) {
      return savedLocation.trim();
    }
    
    // Return null if no valid location is available
    return null;
  };
  
  const effectiveLocation = getEffectiveLocation();
  
  // Use React Query to fetch from our consolidated backend API endpoint
  const { data, isLoading, error } = useQuery({
    queryKey: ['weather', effectiveLocation],
    queryFn: async () => {
      if (!effectiveLocation) {
        throw new Error("No location available for weather data");
      }
      
      // Prepare the API request to our backend endpoint
      let endpoint = '/api/weather';
      let params = {};
      
      // Check if location is coordinates or string
      const coordPattern = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
      if (coordPattern.test(effectiveLocation)) {
        // Extract coordinates
        const [lat, lon] = effectiveLocation.split(',').map(x => parseFloat(x.trim()));
        params = { lat, lon };
      } else {
        // Use as location name
        params = { location: effectiveLocation };
      }
      
      // Make request to our backend API
      const response = await axios.get(endpoint, { params });
      
      // Return the forecasts array from our API response
      return response.data.forecasts || [];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!effectiveLocation
  });
  
  // Extract the data returned from the API
  const weatherData = data || [];
  
  return { 
    weatherData, 
    isLoading, 
    error: error ? (error as Error).message : null,
    hasLocation: !!effectiveLocation,
    location: effectiveLocation
  };
}