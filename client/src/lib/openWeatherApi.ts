import { WeatherForecast } from "@shared/schema";
import { apiRequest } from "./queryClient";

// Add client-side caching
interface CacheEntry {
  data: WeatherForecast[];
  timestamp: number;
}

const weatherCache: Record<string, CacheEntry> = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes cache

// This uses the real OpenWeather API through our backend
export async function getWeatherForecast(location?: string): Promise<WeatherForecast[]> {
  try {
    // Validate that we have a proper location
    if (!location || !location.trim()) {
      throw new Error("No location provided for weather forecast");
    }
    
    const effectiveLocation = location.trim();
    
    // No automatic fallbacks - use exactly what was provided
    
    // Check cache first
    const cacheKey = effectiveLocation;
    const now = Date.now();
    if (weatherCache[cacheKey] && (now - weatherCache[cacheKey].timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached weather data for ${effectiveLocation}`);
      return weatherCache[cacheKey].data;
    }
    
    // Cache miss or expired cache, fetch from API
    console.log(`Fetching fresh weather data for ${effectiveLocation}`);
    const response = await apiRequest("GET", `/api/weather?location=${encodeURIComponent(effectiveLocation)}`);
    
    if (!response.ok) {
      throw new Error(`Weather API request failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Cache the response
    weatherCache[cacheKey] = {
      data,
      timestamp: now
    };
    
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
    return formatLocationName(savedLocation);
  }
  
  // Format the location name nicely if it's from the OpenWeather API (contains commas)
  if (location && location.includes(',')) {
    return formatLocationName(location);
  }
  
  // Handle special cases for demo locations
  const locationMap: Record<string, string> = {
    'north': 'North Fields',
    'south': 'South Fields', 
    'greenhouse': 'Greenhouse',
    'default': savedLocation || "Your Location"
  };
  
  if (locationMap[location]) {
    return locationMap[location];
  }
  
  // Otherwise, return the passed location or a default
  return location || "Your Location";
}

function formatLocationName(location: string): string {
  if (!location) return "Your Location";
  
  // Format the location name nicely if it's from the OpenWeather API (contains commas)
  if (location.includes(',')) {
    const parts = location.split(',').map(part => part.trim());
    
    // If we have city, state, country format (e.g., "New York, New York, US")
    if (parts.length === 3) {
      return `${parts[0]}, ${parts[1]}, ${parts[2]}`; // city, state, country
    }
    
    // If we have city, country format (e.g., "New York, US")
    if (parts.length === 2) {
      return `${parts[0]}, ${parts[1]}`;
    }
  }
  
  return location;
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
  // Only show warnings for truly concerning conditions
  return forecast.precipitation > 85 || // Heavy rain (increased from 70%)
         forecast.temperature > 95 ||   // Extreme heat (increased from 90°F)
         forecast.temperature < 32 ||   // Freezing point (reduced from 40°F)
         forecast.wind > 20;            // High winds
}

export function getWeatherWarning(forecast: WeatherForecast): string {
  if (forecast.precipitation > 85) {
    return "Heavy rain expected! Consider postponing planting activities.";
  }
  
  if (forecast.temperature > 95) {
    return "Extreme heat! Provide extra water and shade for plants.";
  }
  
  if (forecast.temperature < 32) {
    return "Freezing temperatures! Protect plants from frost damage.";
  }
  
  if (forecast.wind > 20) {
    return "High winds! Secure young plants and protect structures.";
  }
  
  return "";
}

export function isLocationReal(location: string): boolean {
  // Check if this is a real location (has coordinates or API-formatted name)
  // vs demo/test locations
  const demoLocations = ['north', 'south', 'greenhouse', 'North Fields', 'South Fields', 'Greenhouse'];
  
  if (demoLocations.includes(location)) {
    return false;
  }
  
  // If it contains coordinates or properly formatted location data, it's likely real
  if (location.includes(',') || location.includes('New York')) {
    return true;
  }
  
  return true; // Default to assuming it's real
}

export function getLocationStatus(location: string): { text: string; className: string; icon: string } {
  if (isLocationReal(location)) {
    return {
      text: "Live Weather Data",
      className: "bg-green-100 text-green-800",
      icon: "🌍"
    };
  } else {
    return {
      text: "Demo Location",
      className: "bg-orange-100 text-orange-800", 
      icon: "🏷️"
    };
  }
}
