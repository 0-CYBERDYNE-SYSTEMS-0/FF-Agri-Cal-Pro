/**
 * Weather API service using Open-Meteo (free, reliable, agricultural-focused)
 * Provides current weather and 7-day detailed forecasts for AI agricultural calendar
 * All values are requested from the provider in US units: °F, mph, inches
 */
import axios from 'axios';
import { WeatherForecast } from '@shared/schema';

// Cache for weather data
const weatherCache: Record<string, { data: WeatherForecast[], timestamp: number }> = {};
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes cache

export const WEATHER_UNITS = {
  temperature: '°F',
  wind: 'mph',
  precipitation: 'inches',
  visibility: 'kilometers',
} as const;

export interface WeatherResult {
  locationName: string;
  fetchedAt: string;
  forecasts: WeatherForecast[];
}

// Wire format returned by GET /api/weather
export interface WeatherResponse {
  location: string;
  units: typeof WEATHER_UNITS;
  fetchedAt: string;
  current: WeatherForecast;
  forecast: WeatherForecast[];
}

// Pure mapping from a fetched weather result to the API wire format.
export function formatWeatherData(weatherData: {
  locationName: string;
  fetchedAt: string;
  forecasts: WeatherForecast[];
}): WeatherResponse {
  const [current, ...forecast] = weatherData.forecasts;
  if (!current) {
    throw new Error('No weather data available');
  }
  return {
    location: weatherData.locationName,
    units: WEATHER_UNITS,
    fetchedAt: weatherData.fetchedAt,
    current: { ...current, isCurrent: true },
    forecast: forecast.map((day: WeatherForecast) => ({ ...day, isCurrent: false }))
  };
}

export interface GeocodingResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
  admin1?: string;
  resolvedName: string; // e.g., "City, Country"
}

// Open-Meteo WMO weather interpretation codes
// Reference: https://open-meteo.com/en/docs#weathervariables
const WEATHER_CODES: Record<number, { description: string; icon: string }> = {
  0: { description: "Clear sky", icon: "☀️" },
  1: { description: "Mainly clear", icon: "🌤️" },
  2: { description: "Partly cloudy", icon: "🌥️" },
  3: { description: "Overcast", icon: "☁️" },
  45: { description: "Fog", icon: "🌫️" },
  48: { description: "Depositing rime fog", icon: "🌫️" },
  51: { description: "Drizzle: Light intensity", icon: "💧" },
  53: { description: "Drizzle: Moderate intensity", icon: "💧💧" },
  55: { description: "Drizzle: Dense intensity", icon: "💧💧💧" },
  56: { description: "Freezing Drizzle: Light intensity", icon: "🥶💧" },
  57: { description: "Freezing Drizzle: Dense intensity", icon: "🥶💧💧" },
  61: { description: "Rain: Slight intensity", icon: "🌧️" },
  63: { description: "Rain: Moderate intensity", icon: "🌧️🌧️" },
  65: { description: "Rain: Heavy intensity", icon: "🌧️🌧️🌧️" },
  66: { description: "Freezing Rain: Light intensity", icon: "🥶🌧️" },
  67: { description: "Freezing Rain: Heavy intensity", icon: "🥶🌧️🌧️" },
  71: { description: "Snow fall: Slight intensity", icon: "❄️" },
  73: { description: "Snow fall: Moderate intensity", icon: "❄️❄️" },
  75: { description: "Snow fall: Heavy intensity", icon: "❄️❄️❄️" },
  77: { description: "Snow grains", icon: "❄️🤏" },
  80: { description: "Rain showers: Slight intensity", icon: "🌦️" },
  81: { description: "Rain showers: Moderate intensity", icon: "🌦️🌦️" },
  82: { description: "Rain showers: Violent intensity", icon: "🌦️⛈️" },
  85: { description: "Snow showers: Slight intensity", icon: "🌨️" },
  86: { description: "Snow showers: Heavy intensity", icon: "🌨️🌨️" },
  95: { description: "Thunderstorm: Slight or moderate", icon: "⛈️" },
  96: { description: "Thunderstorm with slight hail", icon: "⛈️🧊" },
  99: { description: "Thunderstorm with heavy hail", icon: "⛈️🧊🧊" },
};

function getWeatherDetails(code: number): { description: string; icon: string } {
  return WEATHER_CODES[code] || { description: "Unknown weather", icon: "❓" };
}

/**
 * Geocode a location string to coordinates using Open-Meteo's geocoding API
 * Falls back to Nominatim (OpenStreetMap) if Open-Meteo fails
 */
export async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  try {
    // Try Open-Meteo first
    const openMeteoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
    const response = await axios.get(openMeteoUrl);
    
    if (response.data.results && response.data.results.length > 0) {
      const result = response.data.results[0];
      return {
        name: result.name,
        lat: result.latitude,
        lon: result.longitude,
        country: result.country,
        state: result.admin1,
        admin1: result.admin1,
        resolvedName: `${result.name}, ${result.admin1 || result.country}`
      };
    }

    // If Open-Meteo fails, try Nominatim
    console.log(`Open-Meteo geocoding failed for ${location}, trying Nominatim...`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
    const nominatimResponse = await axios.get(nominatimUrl, {
      headers: {
        'User-Agent': 'FF-Agri-Cal-Pro/1.0' // Required by Nominatim's terms
      }
    });

    if (nominatimResponse.data && nominatimResponse.data.length > 0) {
      const result = nominatimResponse.data[0];
      const address = result.address || {};
      return {
        name: result.display_name.split(',')[0],
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        country: address.country || 'Unknown',
        state: address.state || address.admin1 || undefined,
        admin1: address.state || address.admin1 || undefined,
        resolvedName: result.display_name
      };
    }

    console.log(`No geocoding results found for location: ${location}`);
    return null;
  } catch (error) {
    console.error('Error in geocoding:', error);
    return null;
  }
}

/**
 * Reverse geocode coordinates to get location name
 * Uses Nominatim (OpenStreetMap) for reverse geocoding
 */
export async function reverseGeocodeCoordinates(lat: number, lon: number): Promise<GeocodingResult | null> {
  try {
    console.log(`Reverse geocoding coordinates: ${lat}, ${lon}`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`;
    const response = await axios.get(nominatimUrl, {
      headers: {
        'User-Agent': 'FF-Agri-Cal-Pro/1.0'
      }
    });

    if (response.data && response.data.address) {
      const address = response.data.address;
      const city = address.city || address.town || address.village || address.county || 'Unknown';
      const state = address.state || '';
      const country = address.country || '';
      
      // Build a nice display name
      let resolvedName = city;
      if (state) resolvedName += `, ${state}`;
      if (country && country !== 'United States') resolvedName += `, ${country}`;
      
      console.log(`Reverse geocoded to: ${resolvedName}`);
      
      return {
        name: city,
        lat,
        lon,
        country,
        state,
        admin1: state,
        resolvedName
      };
    }

    console.log(`No reverse geocoding results for coordinates: ${lat}, ${lon}`);
    return null;
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    return null;
  }
}

/**
 * Fetch comprehensive weather data for a location
 * Handles both string locations and coordinate pairs
 */
export async function fetchComprehensiveWeather(
  locationInput: string | { lat: number; lon: number }
): Promise<WeatherResult | null> {
  try {
    let lat: number;
    let lon: number;
    let resolvedLocationName: string;

    const cacheKey = typeof locationInput === 'string' ? locationInput : `${locationInput.lat},${locationInput.lon}`;
    const now = Date.now();

    // Check cache first
    if (weatherCache[cacheKey] && (now - weatherCache[cacheKey].timestamp < CACHE_EXPIRY)) {
      const cachedEntry = weatherCache[cacheKey];
      let tempLocationName = cacheKey;
      
      if (typeof locationInput === 'string') {
        const geocoded = await geocodeLocation(locationInput);
        tempLocationName = geocoded ? geocoded.resolvedName : locationInput;
      } else {
        // Reverse geocode coordinates for cached data too
        const reverseResult = await reverseGeocodeCoordinates(locationInput.lat, locationInput.lon);
        tempLocationName = reverseResult ? reverseResult.resolvedName : cacheKey;
      }
      return {
        locationName: tempLocationName,
        fetchedAt: new Date(cachedEntry.timestamp).toISOString(),
        forecasts: cachedEntry.data
      };
    }

    // Get coordinates
    if (typeof locationInput === 'string') {
      const geocodingResult = await geocodeLocation(locationInput);
      if (!geocodingResult) {
        console.log(`Could not geocode location: ${locationInput}`);
        return null;
      }
      lat = geocodingResult.lat;
      lon = geocodingResult.lon;
      resolvedLocationName = geocodingResult.resolvedName;
    } else {
      lat = locationInput.lat;
      lon = locationInput.lon;
      
      // Try to reverse geocode coordinates to get human-readable location name
      const reverseResult = await reverseGeocodeCoordinates(lat, lon);
      if (reverseResult) {
        resolvedLocationName = reverseResult.resolvedName;
      } else {
        // Fallback to coordinates if reverse geocoding fails
        resolvedLocationName = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
      }
    }

    // Fetch weather data from Open-Meteo, explicitly requesting US units so the
    // provider (not the client) owns the single unit conversion
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast`;
    const params = {
      latitude: lat,
      longitude: lon,
      current_weather: true,
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,windspeed_10m_max,uv_index_max',
      hourly: 'apparent_temperature,relativehumidity_2m,precipitation,surface_pressure,visibility,uv_index,weathercode',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
    };

    console.log(`Fetching fresh weather data for ${resolvedLocationName} (${lat}, ${lon})`);
    const response = await axios.get(openMeteoUrl, { params });
    const apiData = response.data;

    const forecasts: WeatherForecast[] = [];

    // Process current weather. current_weather.time and hourly.time are both in
    // the provider's local time zone, so match them by string, never by the
    // server's local clock.
    const cw = apiData.current_weather;
    const providerTime: string = cw.time;
    const currentHourKey = providerTime.substring(0, 13) + ":00";
    let currentHourIndex = apiData.hourly.time.indexOf(currentHourKey);

    if (currentHourIndex === -1) {
      for (let i = apiData.hourly.time.length - 1; i >= 0; i--) {
        if (apiData.hourly.time[i] <= providerTime) {
          currentHourIndex = i;
          break;
        }
      }
    }
    if (currentHourIndex === -1) {
      currentHourIndex = 0;
    }

    const currentHourData = {
      apparent_temperature: apiData.hourly.apparent_temperature[currentHourIndex],
      relativehumidity_2m: apiData.hourly.relativehumidity_2m[currentHourIndex],
      precipitation: apiData.hourly.precipitation[currentHourIndex],
      surface_pressure: apiData.hourly.surface_pressure[currentHourIndex],
      visibility: apiData.hourly.visibility[currentHourIndex],
      uv_index: apiData.hourly.uv_index[currentHourIndex],
      weathercode: apiData.hourly.weathercode[currentHourIndex],
    };

    const currentWeatherDetails = getWeatherDetails(currentHourData.weathercode || cw.weathercode);

    // Add current weather to forecasts
    forecasts.push({
      date: providerTime.substring(0, 10),
      dayOfWeek: "Today",
      temperature: parseFloat(cw.temperature.toFixed(1)),
      temp_min: parseFloat(cw.temperature.toFixed(1)),
      temp_max: parseFloat(cw.temperature.toFixed(1)),
      feels_like: parseFloat(currentHourData.apparent_temperature?.toFixed(1) ?? cw.temperature.toFixed(1)),
      weatherDescription: currentWeatherDetails.description,
      icon: currentWeatherDetails.icon,
      wind: parseFloat(cw.windspeed.toFixed(1)),
      humidity: typeof currentHourData.relativehumidity_2m === "number" ? Math.round(currentHourData.relativehumidity_2m) : null,
      precipitation: parseFloat((currentHourData.precipitation ?? 0).toFixed(2)),
      pressure: currentHourData.surface_pressure ? parseFloat(currentHourData.surface_pressure.toFixed(1)) : undefined,
      visibility: currentHourData.visibility ? parseFloat((currentHourData.visibility / 1000).toFixed(1)) : undefined,
      uv_index: currentHourData.uv_index ? parseFloat(currentHourData.uv_index.toFixed(1)) : undefined,
      isCurrent: true,
    });

    // Process daily forecast
    apiData.daily.time.forEach((dateStr: string, idx: number) => {
      if (idx === 0 && forecasts[0]?.date === dateStr) {
        forecasts[0].temp_min = parseFloat(apiData.daily.temperature_2m_min[idx].toFixed(1));
        forecasts[0].temp_max = parseFloat(apiData.daily.temperature_2m_max[idx].toFixed(1));
      } else {
        const dailyWeatherDetails = getWeatherDetails(apiData.daily.weathercode[idx]);
        forecasts.push({
          date: dateStr,
          dayOfWeek: new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', timeZone: apiData.timezone || 'UTC' }),
          temperature: parseFloat(apiData.daily.temperature_2m_max[idx].toFixed(1)),
          temp_min: parseFloat(apiData.daily.temperature_2m_min[idx].toFixed(1)),
          temp_max: parseFloat(apiData.daily.temperature_2m_max[idx].toFixed(1)),
          feels_like: parseFloat(apiData.daily.temperature_2m_max[idx].toFixed(1)),
          weatherDescription: dailyWeatherDetails.description,
          icon: dailyWeatherDetails.icon,
          wind: parseFloat(apiData.daily.windspeed_10m_max[idx].toFixed(1)),
          humidity: null,
          precipitation: parseFloat(apiData.daily.precipitation_sum[idx].toFixed(2)),
          precipitationProbability: typeof apiData.daily.precipitation_probability_max?.[idx] === "number"
            ? Math.round(apiData.daily.precipitation_probability_max[idx])
            : undefined,
          uv_index: apiData.daily.uv_index_max[idx] ? parseFloat(apiData.daily.uv_index_max[idx].toFixed(1)) : undefined,
          isCurrent: false,
        });
      }
    });

    // Cache the data
    weatherCache[cacheKey] = { data: forecasts, timestamp: now };

    console.log(`Weather data processed for ${resolvedLocationName}`);
    return {
      locationName: resolvedLocationName,
      fetchedAt: new Date(now).toISOString(),
      forecasts
    };

  } catch (error) {
    console.error(`Error fetching or processing weather data:`, error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
    }
    return null;
  }
}

/**
 * Agricultural weather recommendations based on current conditions and forecast
 * @param weatherData An object containing current weather and forecast data
 */
export function getAgricultureRecommendations(weatherData: { 
  locationName: string;
  forecasts: WeatherForecast[];
}): string {
  try {
    const current = weatherData.forecasts[0];
    if (!current) {
      throw new Error("No current weather data available");
    }

    const forecast = weatherData.forecasts.slice(1);
    let recommendations = '';
    
    recommendations += `## Current Agricultural Conditions\n\n`;
    recommendations += `**Location:** ${weatherData.locationName}\n`;
    recommendations += `**Current Temperature:** ${current.temperature}°F (feels like ${current.feels_like}°F)\n`;
    recommendations += `**Conditions:** ${current.weatherDescription}\n`;
    recommendations += `**Humidity:** ${current.humidity ?? "unavailable"}\n`;
    recommendations += `**Wind:** ${current.wind} mph\n`;
    recommendations += `**Precipitation:** ${current.precipitation} inches\n\n`;
    
    // Temperature-based recommendations
    if (current.temperature < 40) {
      recommendations += `- ❄️ **Frost Risk**: Protect sensitive crops. Consider row covers, frost blankets, or wind machines.\n`;
      recommendations += `- Water plants minimally as evaporation is very low.\n`;
    } else if (current.temperature >= 40 && current.temperature < 60) {
      recommendations += `- 🌱 **Cool Season Weather**: Ideal for leafy greens, peas, and cool-season crops.\n`;
      recommendations += `- Monitor soil moisture; light watering may be needed.\n`;
    } else if (current.temperature >= 60 && current.temperature < 85) {
      recommendations += `- 🌿 **Optimal Growing Conditions**: Excellent for most crops and agricultural activities.\n`;
      recommendations += `- Regular watering schedule recommended.\n`;
    } else if (current.temperature >= 85 && current.temperature < 95) {
      recommendations += `- 🌡️ **Warm Conditions**: Heat-loving crops like tomatoes, peppers, and corn will thrive.\n`;
      recommendations += `- Increase irrigation frequency. Water deeply in early morning or evening.\n`;
    } else {
      recommendations += `- 🔥 **Heat Stress Alert**: Protect crops with shade cloth. Avoid midday activities.\n`;
      recommendations += `- Water deeply and frequently. Consider misting systems for sensitive plants.\n`;
    }
    
    // Humidity and wind recommendations
    if (current.humidity !== null && current.humidity < 40) {
      recommendations += `- 💧 **Low Humidity**: Increase watering frequency. Consider mulching to retain moisture.\n`;
    } else if (current.humidity !== null && current.humidity > 80) {
      recommendations += `- 💦 **High Humidity**: Monitor for fungal diseases. Ensure good air circulation.\n`;
    }
    
    if (current.wind > 25) {
      recommendations += `- 🌬️ **Strong Winds**: Secure structures and support tall plants. Consider windbreaks.\n`;
    }
    
    // UV and precipitation recommendations
    if (current.uv_index && current.uv_index > 8) {
      recommendations += `- ☀️ **High UV**: Consider shade protection for sensitive crops during peak hours.\n`;
    }
    
    if (current.precipitation > 0) {
      recommendations += `- ☔ **Active Precipitation**: Avoid working wet soil. Monitor drainage.\n`;
    }
    
    // 7-Day forecast planning
    recommendations += `\n## 7-Day Agricultural Forecast\n\n`;
    recommendations += `| Date | Weather | High/Low | Precip | Wind | Agricultural Activities |\n`;
    recommendations += `|------|---------|----------|--------|------|------------------------|\n`;
    
    forecast.forEach((day: WeatherForecast) => {
      const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let activities = '';
      
      // Determine recommended activities based on conditions
      if (day.precipitation > 0.1) {
        activities = 'Indoor work, planning, equipment maintenance';
      } else if (day.temp_max > 90) {
        activities = 'Early morning irrigation, harvesting';
      } else if (day.temp_max < 45) {
        activities = 'Protect sensitive crops, minimal outdoor work';
      } else if (day.wind > 20) {
        activities = 'Avoid spraying, secure equipment';
      } else {
        activities = 'Ideal for planting, cultivation, spraying';
      }
      
      recommendations += `| ${date} | ${day.weatherDescription} | ${day.temp_max}°/${day.temp_min}° | ${day.precipitation}" | ${day.wind}mph | ${activities} |\n`;
    });
    
    // Weekly recommendations
    const totalPrecipitation = forecast.reduce((sum: number, day: WeatherForecast) => sum + day.precipitation, 0);
    const avgTemp = forecast.reduce((sum: number, day: WeatherForecast) => sum + day.temperature, 0) / forecast.length;
    
    recommendations += `\n## Weekly Summary & Recommendations\n\n`;
    recommendations += `- **Total Expected Precipitation:** ${totalPrecipitation.toFixed(1)} inches\n`;
    recommendations += `- **Average Temperature:** ${Math.round(avgTemp)}°F\n`;
    
    if (totalPrecipitation > 2) {
      recommendations += `- **High Rainfall Week**: Monitor field drainage, delay planting if soils become waterlogged.\n`;
    } else if (totalPrecipitation < 0.5) {
      recommendations += `- **Dry Week**: Plan additional irrigation, consider drought-stress management.\n`;
    }
    
    if (avgTemp > 80) {
      recommendations += `- **Warm Week**: Monitor crops for heat stress, increase watering frequency.\n`;
    } else if (avgTemp < 50) {
      recommendations += `- **Cool Week**: Ideal for cool-season crops, monitor for frost risk.\n`;
    }
    
    return recommendations;
    
  } catch (error) {
    console.error('Error generating agricultural recommendations:', error);
    return 'Unable to generate agricultural recommendations at this time.';
  }
}
