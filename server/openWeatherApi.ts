/**
 * Utility functions for interacting with the OpenWeather API
 */
import axios from 'axios';

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
    humidity: number;
    wind_speed: number;
    weather_description: string;
    icon: string;
  };
  forecast: Array<{
    date: string;
    temp: number;
    weather_description: string;
    icon: string;
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
    // First perform geocoding to get coordinates from a city name
    const geocodingUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`;
    const geocodingResponse = await axios.get(geocodingUrl);
    
    if (!geocodingResponse.data || geocodingResponse.data.length === 0) {
      console.warn(`No geocoding results found for location: ${location}`);
      return null;
    }
    
    return geocodingResponse.data[0] as GeocodingResult;
  } catch (error) {
    console.error('Error geocoding location:', error);
    return null;
  }
}

/**
 * Get current weather data for a location
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
    const response = await axios.get(url);
    return response.data as WeatherData;
  } catch (error) {
    console.error('Error fetching current weather:', error);
    return null;
  }
}

/**
 * Get 5-day forecast data for a location
 */
export async function getForecast(lat: number, lon: number): Promise<ForecastData | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${process.env.OPENWEATHER_API_KEY}`;
    const response = await axios.get(url);
    return response.data as ForecastData;
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    return null;
  }
}

/**
 * Get comprehensive weather information for a location
 */
export async function getWeatherInfo(location: string): Promise<WeatherResponse | null> {
  try {
    // Step 1: Geocode the location
    const geoData = await geocodeLocation(location);
    if (!geoData) {
      return null;
    }
    
    // Step 2: Get current weather
    const currentWeather = await getCurrentWeather(geoData.lat, geoData.lon);
    if (!currentWeather) {
      return null;
    }
    
    // Step 3: Get forecast
    const forecastData = await getForecast(geoData.lat, geoData.lon);
    if (!forecastData) {
      return null;
    }
    
    // Step 4: Format response
    const response: WeatherResponse = {
      location: `${geoData.name}, ${geoData.country}${geoData.state ? `, ${geoData.state}` : ''}`,
      current: {
        temp: currentWeather.main.temp,
        feels_like: currentWeather.main.feels_like,
        humidity: currentWeather.main.humidity,
        wind_speed: currentWeather.wind.speed,
        weather_description: currentWeather.weather[0].description,
        icon: currentWeather.weather[0].icon
      },
      forecast: []
    };
    
    // Process 5-day forecast (at 3-hour intervals)
    // Get one forecast per day (noon time or closest to it)
    const dailyForecasts = new Map<string, any>();
    
    forecastData.list.forEach(item => {
      const date = item.dt_txt.split(' ')[0];
      const hour = parseInt(item.dt_txt.split(' ')[1].split(':')[0]);
      
      // Select forecast closest to noon for each day
      if (!dailyForecasts.has(date) || Math.abs(hour - 12) < Math.abs(parseInt(dailyForecasts.get(date).dt_txt.split(' ')[1].split(':')[0]) - 12)) {
        dailyForecasts.set(date, item);
      }
    });
    
    // Add each day's forecast to the response
    dailyForecasts.forEach((forecast, date) => {
      response.forecast.push({
        date,
        temp: forecast.main.temp,
        weather_description: forecast.weather[0].description,
        icon: forecast.weather[0].icon
      });
    });
    
    return response;
  } catch (error) {
    console.error('Error getting weather information:', error);
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