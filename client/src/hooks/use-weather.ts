import { WeatherForecast } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

// Wire format returned by GET /api/weather
export interface WeatherResponse {
  location: string;
  units: {
    temperature: string;
    wind: string;
    precipitation: string;
    visibility: string;
  };
  fetchedAt: string;
  current: WeatherForecast;
  forecast: WeatherForecast[];
}

const COORD_PATTERN = /^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/;

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

  // Use React Query to fetch from the backend weather endpoint
  const { data, isLoading, error } = useQuery<WeatherResponse>({
    queryKey: ['weather', effectiveLocation],
    queryFn: async () => {
      if (!effectiveLocation) {
        throw new Error("No location available for weather data");
      }

      let params: Record<string, string | number>;
      if (COORD_PATTERN.test(effectiveLocation)) {
        const [lat, lon] = effectiveLocation.split(',').map(x => parseFloat(x.trim()));
        params = { lat, lon };
      } else {
        params = { location: effectiveLocation };
      }

      const response = await axios.get<WeatherResponse>('/api/weather', { params });
      return response.data;
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
    enabled: !!effectiveLocation
  });

  const current = data?.current ?? null;
  const forecast = data?.forecast ?? [];
  const weatherData: WeatherForecast[] = current ? [current, ...forecast] : [];

  return {
    weatherData,
    current,
    forecast,
    units: data?.units ?? null,
    fetchedAt: data?.fetchedAt ?? null,
    resolvedLocation: data?.location ?? null,
    isLoading,
    error: error ? (error as Error).message : null,
    hasLocation: !!effectiveLocation,
    location: effectiveLocation
  };
}
