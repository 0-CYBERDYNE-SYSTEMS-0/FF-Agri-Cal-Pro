import { createContext, useState, useEffect, useContext, ReactNode } from "react";

interface LocationContextType {
  location: string | null;
  coordinates: { lat: number; lon: number } | null;
  isLoading: boolean;
  error: string | null;
  requestLocationPermission: () => void;
}

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{ lat: number; lon: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const saveLocationToStorage = (loc: string) => {
    try {
      localStorage.setItem("userLocation", loc);
    } catch (err) {
      console.error("Could not save location to localStorage:", err);
    }
  };

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
        
        // Try to get city name using reverse geocoding
        try {
          const response = await fetch(
            `https://api.openweathermap.org/geo/1.0/reverse?lat=${latitude}&lon=${longitude}&limit=1&appid=${process.env.OPENWEATHER_API_KEY || "placeholder"}`
          );
          
          if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
              const cityName = data[0].name;
              setLocation(cityName);
              saveLocationToStorage(cityName);
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

  return (
    <LocationContext.Provider
      value={{
        location,
        coordinates,
        isLoading,
        error,
        requestLocationPermission,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
}