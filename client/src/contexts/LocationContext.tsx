import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";

// Define the shape of our context
interface LocationContextType {
  location: string | null;
  coordinates: { lat: number; lon: number } | null;
  isLoading: boolean;
  error: string | null;
  requestLocationPermission: () => void;
}

// Create the context with a default value
const LocationContext = createContext<LocationContextType>({
  location: null,
  coordinates: null,
  isLoading: true,
  error: null,
  requestLocationPermission: () => console.log("Location provider not available, using default location"),
});

/**
 * Location Provider component that provides geolocation functionality
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Save location to localStorage
  const saveLocationToStorage = (loc: string) => {
    try {
      localStorage.setItem("userLocation", loc);
    } catch (err) {
      console.error("Could not save location to localStorage:", err);
    }
  };

  // Get location from browser's geolocation API
  const getLocationFromBrowser = () => {
    setIsLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setIsLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lon: longitude });
        
        // Use our API instead of direct call to OpenWeather API
        try {
          // Use the backend API to do reverse geocoding
          const response = await fetch(
            `/api/weather-data?lat=${latitude}&lon=${longitude}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.location) {
              setLocation(data.location);
              saveLocationToStorage(data.location);
            } else {
              // If we can't resolve a city name, use coordinates as a string
              const locationString = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
              setLocation(locationString);
              saveLocationToStorage(locationString);
            }
          } else {
            // Fallback to coordinates if geocoding fails
            const locationString = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
            setLocation(locationString);
            saveLocationToStorage(locationString);
          }
        } catch (err) {
          console.error("Error in reverse geocoding:", err);
          // Fallback to coordinates
          const locationString = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
          setLocation(locationString);
          saveLocationToStorage(locationString);
        }
        
        setIsLoading(false);
      },
      (err) => {
        console.error("Error getting location:", err);
        setError(`Error getting location: ${err.message}`);
        
        // Try to use saved location if available
        const savedLocation = localStorage.getItem("userLocation");
        if (savedLocation) {
          setLocation(savedLocation);
          setError(null);
        } else {
          // Default to a reasonable location if nothing is available
          setLocation("New York");
          saveLocationToStorage("New York");
        }
        
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  // Initialize location from localStorage or set default on mount
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    
    if (savedLocation) {
      setLocation(savedLocation);
      setIsLoading(false);
    } else {
      // Default location if nothing saved and no permission yet
      setLocation("New York");
      setIsLoading(false);
    }
  }, []);

  const requestLocationPermission = () => {
    getLocationFromBrowser();
  };

  // Create the context value
  const value = {
    location,
    coordinates,
    isLoading,
    error,
    requestLocationPermission,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

/**
 * Custom hook to use the location context
 */
export function useLocation() {
  const context = useContext(LocationContext);
  return context;
}