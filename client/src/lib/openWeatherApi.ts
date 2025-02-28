import { WeatherForecast } from "@shared/schema";
import { apiRequest } from "./queryClient";

// We're using a mock API for demo purposes
// In a real application, you would replace this with actual OpenWeather API calls
export async function getWeatherForecast(location: string = "default"): Promise<WeatherForecast[]> {
  try {
    const response = await apiRequest("GET", `/api/weather?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
}

export function getWeatherIcon(icon: string): string {
  // In a real app, this would map OpenWeather icon codes to actual icons
  return icon;
}

export function getWeatherDescription(description: string): string {
  return description;
}

export function getLocationName(location: string): string {
  // In a real app, this would get the formatted location name
  return "Your Location";
}

// Weather utility functions
export function getWeatherRecommendation(forecast: WeatherForecast): string {
  const { temperature, precipitation } = forecast;
  
  if (precipitation > 50) {
    return "High chance of rain. Consider rescheduling outdoor activities.";
  }
  
  if (temperature > 85) {
    return "High temperature. Ensure plants are well-watered.";
  }
  
  if (temperature < 45) {
    return "Low temperature. Protect sensitive plants from frost.";
  }
  
  return "Good conditions for agricultural activities.";
}

export function shouldShowWeatherWarning(forecast: WeatherForecast): boolean {
  return forecast.precipitation > 70 || forecast.temperature > 90 || forecast.temperature < 40;
}

export function getWeatherWarning(forecast: WeatherForecast): string {
  if (forecast.precipitation > 70) {
    return "Heavy rain expected! Consider postponing planting activities.";
  }
  
  if (forecast.temperature > 90) {
    return "Extreme heat! Provide extra water and shade for plants.";
  }
  
  if (forecast.temperature < 40) {
    return "Frost risk! Cover sensitive plants.";
  }
  
  return "";
}
