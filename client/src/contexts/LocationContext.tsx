import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Function to get address from coordinates using reverse geocoding
  const getAddressFromCoordinates = async (lat: number, lon: number) => {
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      // Extract city and country from the response
      const city = data.address.city || data.address.town || data.address.village || data.address.hamlet || data.address.county || '';
      const state = data.address.state || '';
      const country = data.address.country || '';
      
      const locationString = [city, state, country].filter(Boolean).join(", ");
      return locationString;
    } catch (error) {
      console.error("Error getting location name:", error);
      return "Unknown Location";
    }
  };

  const requestLocationPermission = () => {
    setIsLoading(true);
    setError(null);
    
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      setIsLoading(false);
      
      toast({
        title: "Location Not Available",
        description: "Geolocation is not supported by your browser. Using default location.",
        variant: "destructive",
      });
      
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCoordinates({ lat: latitude, lon: longitude });
        
        // Get address from coordinates
        const locationName = await getAddressFromCoordinates(latitude, longitude);
        setLocation(locationName);
        setIsLoading(false);
        
        toast({
          title: "Location Access Granted",
          description: `Your location is set to: ${locationName}`,
        });
        
        // Save to localStorage
        localStorage.setItem("userLocation", locationName);
        localStorage.setItem("userCoordinates", JSON.stringify({ lat: latitude, lon: longitude }));
      },
      (error) => {
        console.error("Error getting location:", error);
        setError(error.message);
        setIsLoading(false);
        
        toast({
          title: "Location Access Denied",
          description: "Using default location data. Enable location for personalized weather and farming recommendations.",
          variant: "destructive",
        });
      }
    );
  };

  // Load saved location on initial mount
  useEffect(() => {
    const savedLocation = localStorage.getItem("userLocation");
    const savedCoordinates = localStorage.getItem("userCoordinates");
    
    if (savedLocation) {
      setLocation(savedLocation);
    }
    
    if (savedCoordinates) {
      try {
        setCoordinates(JSON.parse(savedCoordinates));
      } catch (error) {
        console.error("Error parsing saved coordinates:", error);
      }
    }
    
    // If no saved location, request it
    if (!savedLocation) {
      // Wait a moment before requesting location to ensure app is loaded
      const timer = setTimeout(() => {
        requestLocationPermission();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []);

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