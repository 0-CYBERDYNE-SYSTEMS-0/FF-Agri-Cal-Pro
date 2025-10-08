/**
 * Weather API service using Open-Meteo (free, reliable, agricultural-focused)
 * Provides current weather and 7-day detailed forecasts for AI agricultural calendar
 */
import axios from 'axios';
import { WeatherForecast } from '@shared/schema';

// Cache for weather data
const weatherCache: Record<string, { data: WeatherForecast[], timestamp: number }> = {};
const CACHE_EXPIRY = 10 * 60 * 1000; // 10 minutes cache

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
): Promise<{ locationName: string, forecasts: WeatherForecast[] } | null> {
  try {
    let lat: number;
    let lon: number;
    let resolvedLocationName: string;

    const cacheKey = typeof locationInput === 'string' ? locationInput : `${locationInput.lat},${locationInput.lon}`;
    const now = Date.now();

    // Check cache first
    if (weatherCache[cacheKey] && (now - weatherCache[cacheKey].timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached weather data for ${cacheKey}`);
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
      
      return { locationName: tempLocationName, forecasts: cachedEntry.data };
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

    // Fetch weather data from Open-Meteo
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast`;
    const params = {
      latitude: lat,
      longitude: lon,
      current_weather: true,
      daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,uv_index_max',
      hourly: 'apparent_temperature,relativehumidity_2m,precipitation,surface_pressure,visibility,uv_index,weathercode',
      timezone: 'auto',
    };

    console.log(`Fetching fresh weather data for ${resolvedLocationName} (${lat}, ${lon})`);
    const response = await axios.get(openMeteoUrl, { params });
    const apiData = response.data;

    const forecasts: WeatherForecast[] = [];

    // Process current weather
    const cw = apiData.current_weather;
    const currentHourISO = new Date().toISOString().substring(0, 13) + ":00";
    let currentHourIndex = apiData.hourly.time.findIndex((t: string) => t === currentHourISO);
    
    if (currentHourIndex === -1) {
      const nowMillis = new Date().getTime();
      currentHourIndex = apiData.hourly.time.reduce((closestIdx: number, t: string, idx: number) => {
        const timeMillis = new Date(t).getTime();
        if (timeMillis <= nowMillis) {
          const closestDiff = Math.abs(nowMillis - new Date(apiData.hourly.time[closestIdx]).getTime());
          const currentDiff = Math.abs(nowMillis - timeMillis);
          return currentDiff < closestDiff ? idx : closestIdx;
        }
        return closestIdx;
      }, 0);
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
      date: new Date(cw.time).toISOString().split('T')[0],
      dayOfWeek: "Today",
      temperature: parseFloat(cw.temperature.toFixed(1)),
      temp_min: parseFloat(cw.temperature.toFixed(1)),
      temp_max: parseFloat(cw.temperature.toFixed(1)),
      feels_like: parseFloat(currentHourData.apparent_temperature?.toFixed(1) ?? cw.temperature.toFixed(1)),
      weatherDescription: currentWeatherDetails.description,
      icon: currentWeatherDetails.icon,
      wind: parseFloat(cw.windspeed.toFixed(1)),
      humidity: Math.round(currentHourData.relativehumidity_2m ?? 50),
      precipitation: parseFloat((currentHourData.precipitation ?? 0).toFixed(1)),
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
          humidity: 50,
          precipitation: parseFloat(apiData.daily.precipitation_sum[idx].toFixed(1)),
          uv_index: apiData.daily.uv_index_max[idx] ? parseFloat(apiData.daily.uv_index_max[idx].toFixed(1)) : undefined,
          isCurrent: false,
        });
      }
    });

    // Cache the data
    weatherCache[cacheKey] = { data: forecasts, timestamp: now };

    console.log(`Weather data processed for ${resolvedLocationName}`);
    return { locationName: resolvedLocationName, forecasts };

  } catch (error) {
    console.error(`Error fetching or processing weather data:`, error);
    if (axios.isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
    }
    return null;
  }
}

/**
 * @deprecated Use fetchComprehensiveWeather instead which provides more detailed data
 * Get current weather data for coordinates (legacy function kept for backward compatibility)
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<any> {
  try {
    console.log('Using fetchComprehensiveWeather instead of getCurrentWeather');
    const result = await fetchComprehensiveWeather({ lat, lon });
    if (!result || !result.forecasts || result.forecasts.length === 0) {
      throw new Error('No weather data available');
    }
    
    // Get the current weather forecast and format it in the legacy structure
    const currentForecast = result.forecasts.find(f => f.isCurrent) || result.forecasts[0];
    
    return {
      name: result.locationName,
      sys: { country: 'XX' },
      main: {
        temp: currentForecast.temperature,
        feels_like: currentForecast.feels_like,
        humidity: currentForecast.humidity,
        pressure: currentForecast.pressure || 1013
      },
      wind: { speed: currentForecast.wind },
      weather: [{ 
        description: currentForecast.weatherDescription, 
        icon: currentForecast.icon
      }]
    };
  } catch (error) {
    console.error('Error in getCurrentWeather:', error);
    
    // Return fallback data (temperatures in Celsius for consistency)
    return {
      name: `${lat.toFixed(2)},${lon.toFixed(2)}`,
      sys: { country: 'XX' },
      main: { temp: 15, feels_like: 15, humidity: 50, pressure: 1013 },
      wind: { speed: 5 },
      weather: [{ description: 'clear sky', icon: '☀️' }]
    };
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
    recommendations += `**Humidity:** ${current.humidity}%\n`;
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
    if (current.humidity < 40) {
      recommendations += `- 💧 **Low Humidity**: Increase watering frequency. Consider mulching to retain moisture.\n`;
    } else if (current.humidity > 80) {
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

// Get forecast data directly from coordinates using Open-Meteo API
export async function getForecast(lat: number, lon: number): Promise<any[] | null> {
  try {
    console.log(`Fetching forecast for coordinates: ${lat}, ${lon}`);
    
    // Use Open-Meteo API directly with coordinates
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,uv_index_max&timezone=auto&forecast_days=7`;
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Open-Meteo API error: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.daily) {
      console.error('No daily forecast data received from Open-Meteo');
      return null;
    }
    
    // Convert Open-Meteo format to our internal format
    const forecast = data.daily.time.map((date: string, index: number) => {
      const tempC = data.daily.temperature_2m_max[index];
      const tempMinC = data.daily.temperature_2m_min[index];
      const tempF = (tempC * 9/5) + 32;
      const tempMinF = (tempMinC * 9/5) + 32;
      
      return {
        date: date,
        dayOfWeek: index === 0 ? 'Today' : new Date(date).toLocaleDateString('en', { weekday: 'long' }),
        temp: Math.round(tempF),
        temp_min: Math.round(tempMinF),
        temp_max: Math.round(tempF),
        feels_like: Math.round(((data.daily.apparent_temperature_max[index] || tempC) * 9/5) + 32),
        weather_description: getWeatherDetails(data.daily.weather_code[index] || 0).description,
        icon: getWeatherDetails(data.daily.weather_code[index] || 0).icon,
        wind: Math.round((data.daily.wind_speed_10m_max[index] || 0) * 0.621371), // km/h to mph
        humidity: 50, // Not available in daily data, using reasonable default
        precipitation: Math.round((data.daily.precipitation_sum[index] || 0) * 0.0393701), // mm to inches
        pressure: 1013, // Not available, using standard pressure
        visibility: 10, // Not available, using good visibility
        uv_index: data.daily.uv_index_max[index] || 0,
        wind_direction: data.daily.wind_direction_10m_dominant[index] || 0
      };
    });
    
    console.log(`Successfully fetched ${forecast.length} day forecast for coordinates: ${lat}, ${lon}`);
    return forecast;
    
  } catch (error) {
    console.error('Error in getForecast:', error);
    return null;
  }
}

/**
 * @deprecated Use fetchComprehensiveWeather instead which provides more detailed and consistent data
 * Get complete weather data (current + forecast) directly from coordinates
 */
export async function getWeatherFromCoordinates(lat: number, lon: number): Promise<any | null> {
  try {
    console.log(`Fetching complete weather data for coordinates: ${lat}, ${lon}`);
    
    // Get current weather and forecast in parallel
    const [currentWeather, forecast] = await Promise.all([
      getCurrentWeather(lat, lon),
      getForecast(lat, lon)
    ]);
    
    if (!currentWeather || !forecast) {
      console.error('Failed to fetch current weather or forecast for coordinates');
      return null;
    }
    
    console.log('currentWeather object received:', JSON.stringify(currentWeather, null, 2));
    
    const tempCelsius = currentWeather.main?.temp || 15; // Default to 15°C if not available
    const tempFahrenheit = Math.round((tempCelsius * 9/5) + 32);
    
    console.log(`Final temperature conversion: ${tempCelsius}°C = ${tempFahrenheit}°F`);
    
    // Format the response with weather data
    const weatherResponse = {
      location: `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
      current: {
        temp: tempFahrenheit,
        feels_like: Math.round(((currentWeather.main?.feels_like || 15) * 9/5) + 32),
        temp_min: Math.round(((currentWeather.main?.temp || 15) * 9/5) + 32),
        temp_max: Math.round(((currentWeather.main?.temp || 15) * 9/5) + 32),
        humidity: currentWeather.main?.humidity || 50,
        wind_speed: Math.round((currentWeather.wind?.speed || 0) * 0.621371), // km/h to mph
        weather_description: currentWeather.weather?.[0]?.description || 'clear sky',
        icon: currentWeather.weather?.[0]?.icon || '01d',
        pressure: Math.round(currentWeather.main?.pressure || 1013),
        visibility: 10, // Default visibility
        precipitation: 0, // Not available in current weather from Open-Meteo
        wind_direction: 0, // Not available in this format
        uv_index: 0 // Not available in current weather
      },
      forecast: forecast || []
    };
    
    console.log('Final weather response:', JSON.stringify(weatherResponse, null, 2));
    
    console.log(`Successfully fetched complete weather data for coordinates: ${lat}, ${lon}`);
    return weatherResponse;
    
  } catch (error) {
    console.error('Error in getWeatherFromCoordinates:', error);
    return null;
  }
}

// Convert internal forecast format to WeatherForecast schema type
function mapToWeatherForecast(forecast: any): WeatherForecast {
  return {
    date: forecast.date,
    dayOfWeek: forecast.dayOfWeek,
    temperature: forecast.temp,
    temp_min: forecast.temp_min,
    temp_max: forecast.temp_max,
    feels_like: forecast.feels_like,
    weatherDescription: forecast.weather_description,
    icon: forecast.icon,
    wind: forecast.wind,
    humidity: forecast.humidity,
    precipitation: forecast.precipitation,
    pressure: forecast.pressure,
    visibility: forecast.visibility,
    uv_index: forecast.uv_index
  };
}

// Helper function to get the WeatherForecast objects for client API
export async function getWeatherForecast(location: string): Promise<WeatherForecast[]> {
  try {
    console.log('Using fetchComprehensiveWeather in getWeatherForecast');
    const result = await fetchComprehensiveWeather(location);
    if (!result || !result.forecasts) {
      return [];
    }
    
    // With the new API, we can just return the forecasts directly
    return result.forecasts;
    
    // This code is no longer needed as fetchComprehensiveWeather already returns proper WeatherForecast objects
  } catch (error) {
    console.error("Error getting weather forecast:", error);
    return [];
  }
}