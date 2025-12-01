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
      
      let params: any = {};
      
      // Check if we have validated location with coordinates in localStorage
      const validatedLocationStr = localStorage.getItem("validatedLocation");
      if (validatedLocationStr) {
        try {
          const validatedLocation = JSON.parse(validatedLocationStr);
          // Prefer coordinates for accuracy
          if (validatedLocation.coordinates) {
            params = {
              lat: validatedLocation.coordinates.lat,
              lon: validatedLocation.coordinates.lon
            };
            console.log('Using validated coordinates for weather:', params);
          }
        } catch (err) {
          console.warn('Failed to parse validated location:', err);
        }
      }
      
      // Fallback to location string if no coordinates
      if (!params.lat || !params.lon) {
        // Check if effectiveLocation is coordinates string
        const coordPattern = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
        if (coordPattern.test(effectiveLocation)) {
          const [lat, lon] = effectiveLocation.split(',').map(x => parseFloat(x.trim()));
          params = { lat, lon };
        } else {
          params = { location: effectiveLocation };
        }
      }
      
      console.log('Fetching weather with params:', params);
      const response = await axios.get('/api/weather', { params });
      
      // Server now returns { locationName, forecasts }
      if (!response.data || !response.data.forecasts) {
        throw new Error('Invalid weather data received from server');
      }
      
      console.log(`Weather data received: ${response.data.forecasts.length} forecasts for ${response.data.locationName}`);
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!effectiveLocation
  });
  
  // Extract the data returned from the API
  const weatherData = data?.forecasts || [];
  const resolvedLocationName = data?.locationName || effectiveLocation;
  
  return { 
    weatherData, 
    isLoading, 
    error: error ? (error as Error).message : null,
    hasLocation: !!effectiveLocation,
    location: effectiveLocation,
    resolvedLocationName
  };
}