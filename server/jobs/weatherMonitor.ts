import { storage } from '../storage';
import { fetchComprehensiveWeather } from '../openWeatherApi';
import type { Event, QuickAction } from '@shared/schema';

/**
 * AI-driven weather monitoring job
 * Checks upcoming weather-dependent events and creates notifications for conflicts
 */
export async function weatherMonitor() {
  const now = new Date();
  const lookAheadDays = 7; // Check next 7 days
  const lookAheadDate = new Date(now.getTime() + lookAheadDays * 24 * 60 * 60 * 1000);

  console.log(`🌤️  Monitoring weather from ${now.toLocaleDateString()} to ${lookAheadDate.toLocaleDateString()}`);

  try {
    // Get all events with checkWeather = true in the next 7 days
    // For demo, using userId = 1
    const userId = 1;
    const allEvents = await storage.getEventsByDateRange(userId, now, lookAheadDate);
    const weatherDependentEvents = allEvents.filter(event => event.checkWeather);

    if (weatherDependentEvents.length === 0) {
      console.log('📭 No weather-dependent events found');
      return;
    }

    console.log(`📅 Found ${weatherDependentEvents.length} weather-dependent events`);

    // Group events by location to minimize API calls
    const eventsByLocation = weatherDependentEvents.reduce((acc, event) => {
      const location = event.location || 'Unknown Location';
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(event);
      return acc;
    }, {} as Record<string, Event[]>);

    // Process each location
    for (const [location, events] of Object.entries(eventsByLocation)) {
      console.log(`🌍 Checking weather for ${location} (${events.length} events)`);

      try {
        const weatherData = await fetchComprehensiveWeather(location);

        if (!weatherData) {
          console.log(`⚠️  Could not fetch weather for ${location}`);
          continue;
        }

        // Check each event for weather conflicts
        for (const event of events) {
          const conflict = await detectWeatherConflict(event, weatherData);

          if (conflict) {
            // Create notification
            await storage.createNotification({
              userId: event.userId,
              eventId: event.id,
              type: 'weather_alert',
              severity: conflict.severity,
              title: conflict.title,
              message: conflict.message,
              icon: conflict.icon,
              suggestedActions: conflict.actions
            });

            console.log(`✉️  Created ${conflict.severity} notification for "${event.title}"`);
          }
        }
      } catch (error) {
        console.error(`❌ Error processing location ${location}:`, error);
      }
    }

    console.log('✅ Weather monitoring completed');
  } catch (error) {
    console.error('❌ Weather monitor failed:', error);
    throw error;
  }
}

/**
 * Detect weather conflicts for an event
 * Returns notification data if conflict found, null otherwise
 */
async function detectWeatherConflict(
  event: Event,
  weatherData: { locationName: string, forecasts: any[] }
): Promise<{
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  icon: string;
  actions: QuickAction[];
} | null> {
  const eventDate = new Date(event.startDate);
  const eventDateString = eventDate.toISOString().split('T')[0];

  // Find forecast for event date
  const forecast = weatherData.forecasts.find(f => 
    f.date.startsWith(eventDateString)
  );

  if (!forecast) {
    return null; // No forecast available for this date
  }

  // Weather conflict detection rules
  const conflicts = [];

  // Rule 1: Rain for outdoor planting/transplanting
  if (forecast.precipitation > 0.1 && 
      (event.title.toLowerCase().includes('plant') || 
       event.title.toLowerCase().includes('transplant') ||
       event.title.toLowerCase().includes('sow'))) {
    
    const rainAmount = forecast.precipitation.toFixed(1);
    const severity = forecast.precipitation > 0.5 ? 'critical' : 'warning';
    
    return {
      severity,
      title: '🌧️ Rain Forecasted',
      message: `${rainAmount}" of rain expected for "${event.title}" on ${eventDate.toLocaleDateString()}. Transplanting in wet conditions can cause shock and root rot.`,
      icon: '🌧️',
      actions: [
        {
          id: 'reschedule',
          label: 'Reschedule Event',
          action: 'reschedule',
          primary: true,
          data: { eventId: event.id, reason: 'rain' }
        },
        {
          id: 'view_forecast',
          label: 'View Full Forecast',
          action: 'view_forecast',
          primary: false,
          data: { location: event.location }
        },
        {
          id: 'dismiss',
          label: 'Keep as Scheduled',
          action: 'dismiss',
          primary: false
        }
      ]
    };
  }

  // Rule 2: Frost warning for tender plants
  if (forecast.temp_min < 32 && 
      (event.title.toLowerCase().includes('tomato') ||
       event.title.toLowerCase().includes('pepper') ||
       event.title.toLowerCase().includes('seedling'))) {
    
    return {
      severity: 'critical',
      title: '❄️ Frost Warning',
      message: `Temperatures dropping to ${forecast.temp_min}°F for "${event.title}". Frost will damage or kill tender plants.`,
      icon: '❄️',
      actions: [
        {
          id: 'reschedule',
          label: 'Reschedule to Warmer Day',
          action: 'reschedule',
          primary: true,
          data: { eventId: event.id, reason: 'frost' }
        },
        {
          id: 'dismiss',
          label: 'I\'ll Use Frost Protection',
          action: 'dismiss',
          primary: false
        }
      ]
    };
  }

  // Rule 3: Extreme heat warning
  if (forecast.temp_max > 95 &&
      (event.title.toLowerCase().includes('plant') ||
       event.title.toLowerCase().includes('work'))) {
    
    return {
      severity: 'warning',
      title: '🌡️ Heat Warning',
      message: `Extreme heat forecasted (${forecast.temp_max}°F) for "${event.title}". Consider working in early morning or evening.`,
      icon: '🌡️',
      actions: [
        {
          id: 'reschedule',
          label: 'Move to Morning',
          action: 'reschedule',
          primary: true,
          data: { eventId: event.id, reason: 'heat', suggestedTime: '06:00' }
        },
        {
          id: 'dismiss',
          label: 'I\'ll Take Precautions',
          action: 'dismiss',
          primary: false
        }
      ]
    };
  }

  // Rule 4: Strong winds for spraying
  if (forecast.wind > 15 &&
      (event.title.toLowerCase().includes('spray') ||
       event.title.toLowerCase().includes('fertiliz'))) {
    
    return {
      severity: 'warning',
      title: '💨 Wind Advisory',
      message: `High winds (${Math.round(forecast.wind)} mph) forecasted for "${event.title}". Spray applications will drift.`,
      icon: '💨',
      actions: [
        {
          id: 'reschedule',
          label: 'Reschedule to Calm Day',
          action: 'reschedule',
          primary: true,
          data: { eventId: event.id, reason: 'wind' }
        },
        {
          id: 'dismiss',
          label: 'Keep Scheduled',
          action: 'dismiss',
          primary: false
        }
      ]
    };
  }

  // Rule 5: Good weather notification (positive!)
  if (forecast.precipitation < 0.05 && 
      forecast.temp_max > 60 && 
      forecast.temp_max < 85 &&
      forecast.wind < 10) {
    
    // Don't create notification for every good day, only for important events
    if (event.title.toLowerCase().includes('plant') ||
        event.title.toLowerCase().includes('harvest')) {
      return {
        severity: 'info',
        title: '☀️ Perfect Weather',
        message: `Ideal conditions for "${event.title}": ${forecast.temp_max}°F, clear skies, light winds.`,
        icon: '☀️',
        actions: [
          {
            id: 'dismiss',
            label: 'Great!',
            action: 'dismiss',
            primary: true
          }
        ]
      };
    }
  }

  // No conflicts detected
  return null;
}
