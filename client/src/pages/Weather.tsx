import { useQuery } from "@tanstack/react-query";
import { WeatherForecast } from "@shared/schema";
import { getWeatherIcon, getLocationName, getWeatherRecommendation, getLocationStatus } from "@/lib/openWeatherApi";
import WeatherRow from "@/components/weather/WeatherRow";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useEffect } from "react";
import { Event } from "@shared/schema";
import { formatDate, isSameDay } from "@/lib/calendarUtils";
import { useLocation } from "@/contexts/LocationContext";
import { useWeather } from "@/hooks/use-weather";
import { MapPin, AlertCircle, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

export default function Weather() {
  const [selectedLocation, setSelectedLocation] = useState("default");
  const [showCustomLocationDialog, setShowCustomLocationDialog] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState("");
  const { location: userLocation, requestLocationPermission, isLoading: locationLoading, error: locationError, hasRequestedPermission } = useLocation();
  
  // Use user's location when available
  useEffect(() => {
    if (userLocation && selectedLocation === "default") {
      setSelectedLocation(userLocation);
    }
  }, [userLocation, selectedLocation]);
  
  // Determine the actual location to use for weather fetching
  const locationToUse = selectedLocation === "default" ? userLocation : selectedLocation;
  
  // Use our weather hook to manage weather data
  const { weatherData, isLoading: isLoadingWeather, error, hasLocation, location: effectiveLocation, resolvedLocationName } = useWeather(locationToUse || undefined);
  
  const { data: events = [], isLoading: isLoadingEvents } = useQuery<Event[]>({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await fetch("/api/events?checkWeather=true", {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }
      
      return response.json();
    }
  });
  
  // Filter events that have the checkWeather flag enabled
  const weatherDependentEvents = events.filter(event => event.checkWeather);
  
  // Group events by date
  const eventsByDate = weatherDependentEvents.reduce((acc, event) => {
    const date = new Date(event.startDate).toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(event);
    return acc;
  }, {} as Record<string, Event[]>);
  
  // Get today's forecast
  const todayForecast = weatherData[0];
  const locationStatus = locationToUse ? getLocationStatus(locationToUse) : null;
  
  // Use resolved location name from server if available, otherwise use locationToUse
  const displayLocationName = resolvedLocationName || getLocationName(locationToUse || "");
  
  // Handle location permission request
  const handleRequestLocation = () => {
    requestLocationPermission();
  };
  
  // Handle manual location selection
  const handleLocationChange = (value: string) => {
    if (value === "custom") {
      setShowCustomLocationDialog(true);
    } else {
      setSelectedLocation(value);
    }
  };

  // Handle custom location input
  const handleCustomLocationSubmit = () => {
    if (customLocationInput.trim()) {
      setSelectedLocation(customLocationInput.trim());
      setShowCustomLocationDialog(false);
      setCustomLocationInput("");
    }
  };
  
  // Show location prompt if no location is available
  if (!hasLocation && !locationLoading && !isLoadingWeather) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-bold text-neutral-900 mb-4">Weather Forecast</h1>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-center mb-4">
              <MapPin className="h-12 w-12 text-blue-500" />
            </div>
            <h2 className="text-xl font-semibold text-blue-900 mb-2">Location Required</h2>
            <p className="text-blue-700 mb-6">
              To show you accurate weather information, we need to know your location. 
              You can either allow location access or manually select a location.
            </p>
            
            {locationError && (
              <Alert className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {locationError}
                </AlertDescription>
              </Alert>
            )}
            
            <div className="space-y-4">
              <Button 
                onClick={handleRequestLocation} 
                className="w-full"
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Getting your location...
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-2" />
                    Use My Current Location
                  </>
                )}
              </Button>
              
              <div className="flex items-center">
                <div className="flex-1 border-t border-gray-200"></div>
                <span className="px-3 text-sm text-gray-500">or</span>
                <div className="flex-1 border-t border-gray-200"></div>
              </div>
              
              <Select value={selectedLocation} onValueChange={handleLocationChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a location manually" />
                </SelectTrigger>
                              <SelectContent>
                <SelectItem value="custom">Enter Custom Location...</SelectItem>
              </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-neutral-900">Weather Forecast</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-lg font-medium text-primary">{displayLocationName}</span>
            {locationStatus && (
              <span className={`text-xs px-2 py-1 rounded-full ${locationStatus.className}`}>
                {locationStatus.icon} {locationStatus.text}
              </span>
            )}
            {userLocation && locationToUse === userLocation && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">📍 Your Location</span>
            )}
            {locationToUse !== userLocation && locationToUse && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">📍 Custom Location</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!userLocation && !locationLoading && (
            <Button variant="outline" size="sm" onClick={handleRequestLocation}>
              <MapPin className="h-4 w-4 mr-1" />
              Get Location
            </Button>
          )}
          <Select value={selectedLocation} onValueChange={handleLocationChange}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select location" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Your Location</SelectItem>
              {userLocation && userLocation !== "default" && (
                <SelectItem value={userLocation}>{userLocation}</SelectItem>
              )}
              <SelectItem value="custom">Enter Custom Location...</SelectItem>
              <SelectItem value="north">North Fields</SelectItem>
              <SelectItem value="south">South Fields</SelectItem>
              <SelectItem value="greenhouse">Greenhouse</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Show loading or error states */}
      {error && (
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}. Please try selecting a different location or check your internet connection.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Current weather card */}
      {isLoadingWeather ? (
        <Skeleton className="h-40 w-full mb-8" />
      ) : todayForecast ? (
        <Card className="bg-primary text-white mb-8 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3">
            <CardContent className="p-6 flex flex-col justify-center">
              <h2 className="text-xl font-medium mb-1">Today's Weather</h2>
              <p className="text-primary-foreground/80">
                {formatDate(new Date(), { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-primary-foreground/90 text-sm mt-1 font-medium">
                📍 {displayLocationName}
              </p>
              
              <div className="mt-4 space-y-1">
                <p className="text-sm flex justify-between">
                  <span>Wind:</span>
                  <span className="font-medium">{todayForecast.wind} mph</span>
                </p>
                <p className="text-sm flex justify-between">
                  <span>Humidity:</span>
                  <span className="font-medium">{todayForecast.humidity}%</span>
                </p>
                <p className="text-sm flex justify-between">
                  <span>Precipitation:</span>
                  <span className="font-medium">{todayForecast.precipitation}%</span>
                </p>
              </div>
            </CardContent>
            
            <CardContent className="p-6 flex flex-col md:items-center justify-center text-center">
              <div className="text-7xl mb-2">{todayForecast.icon}</div>
              <p className="text-3xl font-medium">{todayForecast.temperature}°F</p>
              <p className="text-primary-foreground/80">{todayForecast.weatherDescription}</p>
            </CardContent>
            
            <CardContent className="p-6 bg-primary-dark flex flex-col justify-center">
              <h3 className="text-lg font-medium mb-2">Agricultural Recommendation</h3>
              <p className="text-sm">{getWeatherRecommendation(todayForecast)}</p>
              
              {eventsByDate[todayForecast.date]?.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-1">Today's Weather-Dependent Events:</h4>
                  <ul className="text-sm space-y-1">
                    {eventsByDate[todayForecast.date].map(event => (
                      <li key={event.id} className="flex items-center">
                        <span className="h-1.5 w-1.5 bg-white rounded-full mr-2"></span>
                        {event.title} - {formatDate(new Date(event.startDate), { hour: 'numeric', minute: '2-digit' })}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </div>
        </Card>
      ) : null}
      
      {/* 7-day forecast */}
      <div className="mb-8">
        <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">7-Day Forecast</h2>
        <WeatherRow 
          forecasts={weatherData} 
          isLoading={isLoadingWeather}
          location={locationToUse}
        />
      </div>
      
      {/* Weather-dependent events */}
      <div>
        <h2 className="text-lg font-serif font-bold text-neutral-900 mb-4">Weather-Dependent Events</h2>
        
        {isLoadingEvents ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : weatherDependentEvents.length > 0 ? (
          <div className="space-y-2">
            {weatherData.map((forecast: WeatherForecast) => {
              const eventsOnDay = eventsByDate[forecast.date] || [];
              
              if (eventsOnDay.length === 0) return null;
              
              return (
                <Card key={forecast.date} className="overflow-hidden">
                  <div className="flex items-center">
                    <div className="bg-neutral-100 p-4 text-center w-24">
                      <div className="text-2xl">{forecast.icon}</div>
                      <div className="text-sm font-medium">{forecast.temperature}°F</div>
                      <div className="text-xs text-neutral-500">{forecast.dayOfWeek}</div>
                    </div>
                    
                    <CardContent className="flex-1 p-4">
                      <h3 className="text-sm font-medium mb-2">
                        {formatDate(new Date(forecast.date), { weekday: 'long', month: 'short', day: 'numeric' })}
                      </h3>
                      
                      <div className="space-y-2">
                        {eventsOnDay.map(event => (
                          <div key={event.id} className="text-sm flex justify-between">
                            <div className="font-medium">{event.title}</div>
                            <div className="text-neutral-500">
                              {formatDate(new Date(event.startDate), { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            }).filter(Boolean)}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-neutral-500">
              <p>No weather-dependent events found. Create events with the "Check weather conditions" option enabled.</p>
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Custom Location Dialog */}
      <Dialog open={showCustomLocationDialog} onOpenChange={setShowCustomLocationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Custom Location</DialogTitle>
            <DialogDescription>
              Enter a city, address, or coordinates (e.g., "Portland, OR", "Seattle", "40.7128,-74.0060")
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="e.g., Portland, OR or Seattle, WA"
              value={customLocationInput}
              onChange={(e) => setCustomLocationInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomLocationSubmit();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomLocationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomLocationSubmit} disabled={!customLocationInput.trim()}>
              Set Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
