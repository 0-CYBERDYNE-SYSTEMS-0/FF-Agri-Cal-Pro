/**
 * Utility functions for interacting with the OpenWeather API
 */
import axios from 'axios';
import { WeatherForecast } from '@shared/schema';

// Add a cache for weather data
const weatherCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_EXPIRY = 15 * 60 * 1000; // 15 minutes in milliseconds

export interface GeocodingResult {
  name: string;
  lat: number;
  lon: number;
  country: string;
  state?: string;
}

export interface WeatherData {
  coord: {
    lon: number;
    lat: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  base: string;
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
    sea_level?: number;
    grnd_level?: number;
  };
  visibility: number;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  snow?: {
    '1h'?: number;
    '3h'?: number;
  };
  clouds: {
    all: number;
  };
  dt: number;
  sys: {
    type?: number;
    id?: number;
    country: string;
    sunrise: number;
    sunset: number;
  };
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

export interface ForecastData {
  cod: string;
  message: number;
  cnt: number;
  list: Array<{
    dt: number;
    main: {
      temp: number;
      feels_like: number;
      temp_min: number;
      temp_max: number;
      pressure: number;
      sea_level: number;
      grnd_level: number;
      humidity: number;
      temp_kf: number;
    };
    weather: Array<{
      id: number;
      main: string;
      description: string;
      icon: string;
    }>;
    clouds: {
      all: number;
    };
    wind: {
      speed: number;
      deg: number;
      gust: number;
    };
    visibility: number;
    pop: number;
    rain?: {
      '3h': number;
    };
    snow?: {
      '3h': number;
    };
    sys: {
      pod: string;
    };
    dt_txt: string;
  }>;
  city: {
    id: number;
    name: string;
    coord: {
      lat: number;
      lon: number;
    };
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

interface WeatherResponse {
  location: string;
  current: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    humidity: number;
    wind_speed: number;
    weather_description: string;
    icon: string;
    pressure: number;
    visibility: number;
  };
  forecast: Array<{
    date: string;
    dayOfWeek: string;
    temp: number;
    temp_min: number;
    temp_max: number;
    feels_like: number;
    weather_description: string;
    icon: string;
    wind: number;
    humidity: number;
    precipitation: number;
    pressure?: number;
    visibility?: number;
    uv_index?: number;
  }>;
  alerts?: Array<{
    event: string;
    description: string;
    start: number;
    end: number;
  }>;
}

/**
 * Geocode a location (city name) to get coordinates
 */
export async function geocodeLocation(location: string): Promise<GeocodingResult | null> {
  try {
    // Use default locations for common terms
    if (location === 'default') {
      return {
        name: "New York",
        lat: 40.7128,
        lon: -74.0060,
        country: "US",
        state: "New York"
      };
    }
    
    // Clean up the location string
    const cleanLocation = location.trim().replace(/\s+/g, ' ');
    
    // Use HTTPS for better security
    const geocodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(cleanLocation)}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);
    
    if (!geocodingResponse.data || geocodingResponse.data.length === 0) {
      console.warn(`No geocoding results found for location: ${location}`);
      
      // If this is a complex location (like "Lane County, Oregon, United States"),
      // try to extract just the city part or use a simpler location description
      if (location.includes(',')) {
        const simplifiedLocation = location.split(',')[0].trim();
        console.log(`Retrying with simplified location: ${simplifiedLocation}`);
        return geocodeLocation(simplifiedLocation);
      }
      
      // As a fallback, return New York coordinates
      console.log(`Using fallback coordinates for New York`);
      return {
        name: "New York",
        lat: 40.7128,
        lon: -74.0060,
        country: "US",
        state: "New York"
      };
    }
    
    return geocodingResponse.data[0] as GeocodingResult;
  } catch (error) {
    console.error('Error geocoding location:', error);
    
    // As a fallback, return New York coordinates
    console.log(`Using fallback coordinates for New York due to error`);
    return {
      name: "New York",
      lat: 40.7128,
      lon: -74.0060,
      country: "US",
      state: "New York"
    };
  }
}

/**
 * Get current weather data for a location
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
    const response = await axios.get(url);
    console.log('Successfully fetched current weather for coordinates:', lat, lon);
    return response.data as WeatherData;
  } catch (error) {
    console.error('Error fetching current weather:', error);
    // Create a simple mock weather response as fallback
    console.log('Using fallback mock weather data due to API error');
    return {
      coord: { lon: lon, lat: lat },
      weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
      base: 'fallback',
      main: { temp: 22, feels_like: 22, temp_min: 20, temp_max: 24, pressure: 1015, humidity: 50 },
      visibility: 10000,
      wind: { speed: 2, deg: 180 },
      clouds: { all: 0 },
      dt: Math.floor(Date.now() / 1000),
      sys: { country: 'US', sunrise: Math.floor((Date.now() - 21600000) / 1000), sunset: Math.floor((Date.now() + 21600000) / 1000), type: 1, id: 1 },
      timezone: 0,
      id: 1,
      name: 'Fallback Location',
      cod: 200
    };
  }
}

/**
 * Get 5-day forecast data for a location
 */
export async function getForecast(lat: number, lon: number): Promise<ForecastData | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
    const response = await axios.get(url);
    console.log('Successfully fetched forecast data for coordinates:', lat, lon);
    return response.data as ForecastData;
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    
    // Generate mock forecast data as fallback
    console.log('Using fallback mock forecast data due to API error');
    
    // Create a 5-day forecast with 8 data points per day (3-hour intervals)
    const now = new Date();
    const mockList = [];
    
    for (let day = 0; day < 5; day++) {
      for (let hour = 0; hour < 24; hour += 3) {
        const forecastDate = new Date(now);
        forecastDate.setDate(now.getDate() + day);
        forecastDate.setHours(hour, 0, 0, 0);
        
        const dtTxt = forecastDate.toISOString().replace('T', ' ').slice(0, 19);
        
        // Randomize weather a bit based on the day
        const weatherTypes = [
          { id: 800, main: 'Clear', description: 'clear sky', icon: '01d' },
          { id: 801, main: 'Clouds', description: 'few clouds', icon: '02d' },
          { id: 500, main: 'Rain', description: 'light rain', icon: '10d' }
        ];
        
        const weatherIndex = (day + hour) % weatherTypes.length;
        
        mockList.push({
          dt: Math.floor(forecastDate.getTime() / 1000),
          main: {
            temp: 20 + day + (Math.random() * 5),
            feels_like: 20 + day + (Math.random() * 3),
            temp_min: 18 + day,
            temp_max: 25 + day,
            pressure: 1015,
            sea_level: 1015,
            grnd_level: 1010,
            humidity: 40 + (day * 5),
            temp_kf: 0
          },
          weather: [weatherTypes[weatherIndex]],
          clouds: { all: weatherIndex * 20 },
          wind: { speed: 2 + (day * 0.5), deg: 180, gust: 3 + (day * 0.5) },
          visibility: 10000,
          pop: weatherIndex === 2 ? 0.3 : 0,
          sys: { pod: hour >= 6 && hour < 18 ? 'd' : 'n' },
          dt_txt: dtTxt
        });
      }
    }
    
    return {
      cod: "200",
      message: 0,
      cnt: mockList.length,
      list: mockList,
      city: {
        id: 1,
        name: "Fallback City",
        coord: { lat: lat, lon: lon },
        country: "US",
        population: 100000,
        timezone: 0,
        sunrise: Math.floor((Date.now() - 21600000) / 1000),
        sunset: Math.floor((Date.now() + 21600000) / 1000)
      }
    };
  }
}

// Convert from Celsius to Fahrenheit
function celsiusToFahrenheit(celsius: number): number {
  return Math.round(celsius * 9/5 + 32);
}

/**
 * Get comprehensive weather information for a location
 */
export async function getWeatherInfo(location: string): Promise<WeatherResponse | null> {
  try {
    // Check if we have cached data for this location
    const now = Date.now();
    if (weatherCache[location] && (now - weatherCache[location].timestamp < CACHE_EXPIRY)) {
      console.log(`Using cached weather data for ${location}`);
      return weatherCache[location].data;
    }
    
    // If no cached data or cache expired, fetch from API
    console.log(`Fetching fresh weather data for ${location}`);
    const geocodingResult = await geocodeLocation(location);
    
    if (!geocodingResult) {
      return null;
    }
    
    const { lat, lon } = geocodingResult;
    
    // Get current weather and forecast data
    const [currentWeatherData, forecastData] = await Promise.all([
      getCurrentWeather(lat, lon),
      getForecast(lat, lon)
    ]);
    
    if (!currentWeatherData || !forecastData) {
      return null;
    }
    
    // Process forecast data into more usable format
    const processedForecast = processDailyForecast(forecastData);
    
    // Format the location string
    const locationString = geocodingResult.state 
      ? `${geocodingResult.name}, ${geocodingResult.country}, ${geocodingResult.state}`
      : `${geocodingResult.name}, ${geocodingResult.country}`;
    
    // Create the response object
    const response: WeatherResponse = {
      location: locationString,
      current: {
        temp: celsiusToFahrenheit(currentWeatherData.main.temp),
        feels_like: celsiusToFahrenheit(currentWeatherData.main.feels_like),
        temp_min: celsiusToFahrenheit(currentWeatherData.main.temp_min),
        temp_max: celsiusToFahrenheit(currentWeatherData.main.temp_max),
        humidity: currentWeatherData.main.humidity,
        wind_speed: (currentWeatherData.wind.speed * 2.237).toFixed(1), // Convert from m/s to mph
        weather_description: currentWeatherData.weather[0].description,
        icon: currentWeatherData.weather[0].icon,
        pressure: currentWeatherData.main.pressure,
        visibility: currentWeatherData.visibility
      },
      forecast: processedForecast.map(day => ({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        temp: celsiusToFahrenheit(day.temp),
        temp_min: celsiusToFahrenheit(day.temp_min),
        temp_max: celsiusToFahrenheit(day.temp_max),
        feels_like: celsiusToFahrenheit(day.feels_like),
        weather_description: day.weather_description,
        icon: day.icon,
        wind: Math.round(day.wind * 2.237), // Convert from m/s to mph
        humidity: day.humidity,
        precipitation: day.precipitation,
        pressure: day.pressure,
        visibility: day.visibility
      }))
    };
    
    // Cache the result
    weatherCache[location] = {
      data: response,
      timestamp: now
    };
    
    return response;
    
  } catch (error) {
    console.error("Error getting weather info:", error);
    return null;
  }
}

/**
 * Format weather data for farming-specific recommendations
 */
export function getAgricultureRecommendations(weatherData: WeatherResponse): string {
  try {
    const { current, forecast } = weatherData;
    let recommendations = '';
    
    // Current conditions recommendations
    recommendations += `## Current Weather Recommendations\n\n`;
    
    // Temperature-based recommendations
    if (current.temp < 5) {
      recommendations += `- ❄️ **Cold Alert**: Protect sensitive crops from frost damage. Consider using row covers or frost blankets.\n`;
      recommendations += `- Water plants minimally as soil moisture evaporates slowly in cold weather.\n`;
    } else if (current.temp >= 5 && current.temp < 15) {
      recommendations += `- 🌱 **Cool Conditions**: Good for leafy greens and cool-season crops.\n`;
      recommendations += `- Monitor soil moisture as moderate watering may be needed.\n`;
    } else if (current.temp >= 15 && current.temp < 25) {
      recommendations += `- 🌿 **Ideal Temperature**: Favorable growing conditions for most crops.\n`;
      recommendations += `- Regular watering recommended, especially for newly planted crops.\n`;
    } else if (current.temp >= 25 && current.temp < 32) {
      recommendations += `- 🌡️ **Warm Conditions**: Heat-loving crops like tomatoes and peppers will thrive.\n`;
      recommendations += `- Increase watering frequency to prevent soil from drying out.\n`;
    } else {
      recommendations += `- 🔥 **Heat Alert**: Protect plants from heat stress. Consider shade cloth for sensitive crops.\n`;
      recommendations += `- Water deeply in the early morning or evening to reduce evaporation loss.\n`;
    }
    
    // Humidity-based recommendations
    if (current.humidity < 30) {
      recommendations += `- 💧 **Low Humidity**: Increase watering frequency to compensate for dry air.\n`;
    } else if (current.humidity > 80) {
      recommendations += `- 💦 **High Humidity**: Monitor for fungal diseases. Ensure good air circulation between plants.\n`;
    }
    
    // Wind-based recommendations
    if (current.wind_speed > 20) {
      recommendations += `- 🌬️ **Strong Winds**: Protect young plants and secure structures. Consider windbreaks.\n`;
    }
    
    // Weather condition recommendations
    if (current.weather_description.includes('rain') || current.weather_description.includes('drizzle')) {
      recommendations += `- ☔ **Rainy Conditions**: Avoid working wet soil to prevent compaction. Monitor for excess water drainage.\n`;
    } else if (current.weather_description.includes('clear')) {
      recommendations += `- ☀️ **Clear Skies**: Ideal for outdoor farming activities and harvesting.\n`;
    } else if (current.weather_description.includes('cloud')) {
      recommendations += `- ☁️ **Cloudy Conditions**: Good for transplanting or working with young seedlings.\n`;
    }
    
    // Forecast-based planning
    recommendations += `\n## 5-Day Forecast Planning\n\n`;
    recommendations += `| Date | Weather | Temperature | Farming Activities |\n`;
    recommendations += `|------|---------|-------------|-------------------|\n`;
    
    forecast.forEach(day => {
      const date = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      let activities = '';
      
      // Suggest activities based on forecast
      if (day.weather_description.includes('rain') || day.weather_description.includes('shower')) {
        activities = 'Indoor tasks, greenhouse work, equipment maintenance';
      } else if (day.temp < 10) {
        activities = 'Cold-hardy planting, soil preparation, winter crop management';
      } else if (day.temp >= 10 && day.temp < 25) {
        activities = 'General planting, weeding, harvesting, crop maintenance';
      } else {
        activities = 'Early/late day work, irrigation, heat-tolerant crop management';
      }
      
      recommendations += `| ${date} | ${day.weather_description} | ${Math.round(day.temp)}°C | ${activities} |\n`;
    });
    
    return recommendations;
  } catch (error) {
    console.error('Error generating agriculture recommendations:', error);
    return 'Unable to generate agriculture-specific weather recommendations at this time.';
  }
}

// Helper function to process a daily forecast
function processDailyForecast(forecastData: ForecastData): Array<{
  date: string;
  dayOfWeek: string;
  temp: number;
  temp_min: number;
  temp_max: number;
  feels_like: number;
  weather_description: string;
  icon: string;
  wind: number;
  humidity: number;
  precipitation: number;
  pressure?: number;
  visibility?: number;
}> {
  const processedForecasts: Array<{
    date: string;
    dayOfWeek: string;
    temp: number;
    temp_min: number;
    temp_max: number;
    feels_like: number;
    weather_description: string;
    icon: string;
    wind: number;
    humidity: number;
    precipitation: number;
    pressure?: number;
    visibility?: number;
  }> = [];
  const processedDays = new Set<string>();
  
  // Group forecast items by day
  const dailyForecasts = new Map<string, any[]>();
  
  forecastData.list.forEach(item => {
    const date = item.dt_txt.split(' ')[0]; // Get just the date part
    if (!dailyForecasts.has(date)) {
      dailyForecasts.set(date, []);
    }
    dailyForecasts.get(date)!.push(item);
  });
  
  // Process each day's forecasts
  dailyForecasts.forEach((items, date) => {
    // Get the forecast for 12:00 or the closest time for representative daytime conditions
    const midday = items.find(item => item.dt_txt.includes('12:00:00')) || items[0];
    
    // Calculate min and max temperature across all time periods for that day
    let min_temp = Infinity;
    let max_temp = -Infinity;
    
    items.forEach(item => {
      if (item.main.temp_min < min_temp) min_temp = item.main.temp_min;
      if (item.main.temp_max > max_temp) max_temp = item.main.temp_max;
    });
    
    // Format dates
    const dateObj = new Date(date);
    const dayOfWeek = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(dateObj);
    
    // Calculate precipitation probability (average for the day)
    const precipitation = items.reduce((acc, item) => acc + (item.pop || 0), 0) / items.length * 100;
    
    // Create the forecast object
    processedForecasts.push({
      date,
      dayOfWeek,
      temp: midday.main.temp,
      temp_min: min_temp,
      temp_max: max_temp,
      feels_like: midday.main.feels_like,
      weather_description: midday.weather[0].description,
      icon: midday.weather[0].icon,
      wind: Math.round(midday.wind.speed),
      humidity: midday.main.humidity,
      precipitation: Math.round(precipitation),
      pressure: midday.main.pressure,
      visibility: midday.visibility
    });
    
    processedDays.add(date);
  });
  
  // Sort forecasts by date
  processedForecasts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  return processedForecasts;
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
    const weatherInfo = await getWeatherInfo(location);
    if (!weatherInfo) {
      return [];
    }
    
    // Map the server's internal forecast format to the schema format
    const forecasts: WeatherForecast[] = [
      // Add current weather as first item
      {
        date: new Date().toISOString().split('T')[0],
        dayOfWeek: 'Today',
        temperature: weatherInfo.current.temp,
        temp_min: weatherInfo.current.temp_min,
        temp_max: weatherInfo.current.temp_max,
        feels_like: weatherInfo.current.feels_like,
        weatherDescription: weatherInfo.current.weather_description,
        icon: weatherInfo.current.icon,
        wind: Math.round(weatherInfo.current.wind_speed),
        humidity: weatherInfo.current.humidity,
        precipitation: 0, // This isn't in current weather data
        pressure: weatherInfo.current.pressure,
        visibility: weatherInfo.current.visibility,
        uv_index: 0,
        isCurrent: true
      },
      // Add the rest of the forecast days
      ...weatherInfo.forecast.map(forecast => mapToWeatherForecast(forecast))
    ];
    
    return forecasts;
  } catch (error) {
    console.error("Error getting weather forecast:", error);
    return [];
  }
}