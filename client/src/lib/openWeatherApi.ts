import { WeatherForecast } from "@shared/schema";
import { apiRequest } from "./queryClient";

// This uses the real OpenWeather API through our backend
export async function getWeatherForecast(location?: string): Promise<WeatherForecast[]> {
  try {
    // Try to get location from localStorage if not provided
    if (!location) {
      const savedLocation = localStorage.getItem("userLocation");
      location = savedLocation || "default";
    }
    
    const response = await apiRequest("GET", `/api/weather?location=${encodeURIComponent(location)}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching weather data:", error);
    throw error;
  }
}

export function getWeatherIcon(icon: string): string {
  // Map OpenWeather icon codes to emoji icons
  const iconMap: {[key: string]: string} = {
    '01d': '☀️', // clear sky day
    '01n': '🌙', // clear sky night
    '02d': '⛅', // few clouds day
    '02n': '☁️', // few clouds night
    '03d': '☁️', // scattered clouds
    '03n': '☁️',
    '04d': '☁️', // broken clouds
    '04n': '☁️',
    '09d': '🌧️', // shower rain
    '09n': '🌧️',
    '10d': '🌦️', // rain
    '10n': '🌧️',
    '11d': '⛈️', // thunderstorm
    '11n': '⛈️',
    '13d': '❄️', // snow
    '13n': '❄️',
    '50d': '🌫️', // mist
    '50n': '🌫️'
  };
  
  // If we have a direct match for the icon code
  if (iconMap[icon]) {
    return iconMap[icon];
  }
  
  // Otherwise check if it's an emoji already
  if (icon && typeof icon === 'string' && (icon.includes('️') || icon.codePointAt(0)! > 127)) {
    return icon;
  }
  
  // Check for common icon code patterns and return appropriate emoji
  if (icon && typeof icon === 'string') {
    // Extract the number part from icon codes like "01d", "02n", etc.
    const iconCode = icon.replace(/[dn]$/, '');
    
    if (iconCode === '01') return '☀️';
    if (iconCode === '02') return '⛅';
    if (iconCode === '03' || iconCode === '04') return '☁️';
    if (iconCode === '09') return '🌧️';
    if (iconCode === '10') return '🌦️';
    if (iconCode === '11') return '⛈️';
    if (iconCode === '13') return '❄️';
    if (iconCode === '50') return '🌫️';
  }
  
  // Default icon if no match
  return '🌤️';
}

export function getWeatherDescription(description: string): string {
  // Capitalize the first letter of each word for better presentation
  if (!description) return '';
  
  return description
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getLocationName(location: string): string {
  // If we have a user's saved location, use that
  const savedLocation = localStorage.getItem("userLocation");
  if (savedLocation && (location === "default" || !location)) {
    return savedLocation;
  }
  
  // Format the location name nicely if it's from the OpenWeather API (contains commas)
  if (location && location.includes(',')) {
    const parts = location.split(',').map(part => part.trim());
    // If we have city, country, state format
    if (parts.length === 3) {
      return `${parts[0]}, ${parts[2]}`;
    }
    // If we have city, country format
    if (parts.length === 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
  }
  
  // Otherwise, return the passed location or a default
  return location === "default" ? "New York, USA" : (location || "Your Location");
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
