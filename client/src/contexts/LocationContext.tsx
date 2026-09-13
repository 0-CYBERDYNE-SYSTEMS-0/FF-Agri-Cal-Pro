import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useRef } from "react";
import { locationService, ValidatedLocation, LocationValidationResult } from "../lib/locationService";

export type AdviceMode = "general" | "local";

const ADVICE_MODE_STORAGE_KEY = "adviceMode";

function loadStoredAdviceMode(): AdviceMode {
  try {
    const saved = localStorage.getItem(ADVICE_MODE_STORAGE_KEY);
    if (saved === "general" || saved === "local") {
      return saved;
    }
  } catch (err) {
    console.error("Could not read advice mode from localStorage:", err);
  }
  return "local";
}

// Define the shape of our context
interface LocationContextType {
  location: string | null;
  coordinates: { lat: number; lon: number } | null;
  isLoading: boolean;
  error: string | null;
  requestLocationPermission: () => void;
  hasRequestedPermission: boolean;
  validatedLocation: ValidatedLocation | null;
  setLocation: (location: string) => Promise<LocationValidationResult>;
  locationChangeDetected: boolean;
  dismissLocationChange: () => void;
  confidence: number;
  source: 'gps' | 'user_input' | 'cached' | 'fallback' | null;
  adviceMode: AdviceMode;
  setAdviceMode: (mode: AdviceMode) => void;
}

// Create the context with a default value
const LocationContext = createContext<LocationContextType>({
  location: null,
  coordinates: null,
  isLoading: true,
  error: null,
  requestLocationPermission: () =>
    console.log("Location provider not available, using default location"),
  hasRequestedPermission: false,
  validatedLocation: null,
  setLocation: async () => ({ success: false, error: "Location provider not available" }),
  locationChangeDetected: false,
  dismissLocationChange: () => {},
  confidence: 0,
  source: null,
  adviceMode: "local",
  setAdviceMode: () => {},
});

/**
 * Location Provider component that provides geolocation functionality
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false);
  const [validatedLocation, setValidatedLocation] = useState<ValidatedLocation | null>(null);
  const [locationChangeDetected, setLocationChangeDetected] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [source, setSource] = useState<'gps' | 'user_input' | 'cached' | 'fallback' | null>(null);
  const [adviceMode, setAdviceModeState] = useState<AdviceMode>(loadStoredAdviceMode);
  
  // Add refs to prevent multiple simultaneous lookups
  const isLookingUpRef = useRef(false);
  const lastLookupTimeRef = useRef(0);

  // Update location state from validated location
  const updateLocationFromValidated = useCallback((validated: ValidatedLocation) => {
    setLocationState(validated.name);
    setCoordinates(validated.coordinates);
    setValidatedLocation(validated);
    setConfidence(validated.confidence);
    setSource(validated.source);
    
    // Save to localStorage
    try {
      localStorage.setItem("userLocation", validated.name);
      localStorage.setItem("validatedLocation", JSON.stringify(validated));
      console.log("Updated location:", validated.name, "Confidence:", validated.confidence);
    } catch (err) {
      console.error("Could not save location to localStorage:", err);
    }
  }, []);

  // Set location with validation
  const setLocation = useCallback(async (locationInput: string): Promise<LocationValidationResult> => {
    try {
      setIsLoading(true);
      setError(null);
      
      const result = await locationService.validateLocationInput(locationInput);
      
      if (result.success && result.location) {
        // Check for location change
        const currentLocation = locationService.getCurrentLocation();
        if (currentLocation && locationService.detectLocationChange(result.location)) {
          setLocationChangeDetected(true);
          console.warn("Location change detected:", {
            from: currentLocation.name,
            to: result.location.name
          });
        }
        
        updateLocationFromValidated(result.location);
      } else {
        setError(result.error || "Failed to validate location");
      }
      
      setIsLoading(false);
      return result;
    } catch (error) {
      const errorMsg = "Failed to set location";
      setError(errorMsg);
      setIsLoading(false);
      console.error("Location setting error:", error);
      return { success: false, error: errorMsg };
    }
  }, [updateLocationFromValidated]);

  // Dismiss location change notification
  const dismissLocationChange = useCallback(() => {
    setLocationChangeDetected(false);
  }, []);

  // Save location to localStorage (legacy function for compatibility)
  const saveLocationToStorage = useCallback((loc: string) => {
    try {
      localStorage.setItem("userLocation", loc);
      console.log("Saved location to storage:", loc);
    } catch (err) {
      console.error("Could not save location to localStorage:", err);
    }
  }, []);

  // Get location from browser's geolocation API using location service
  const getLocationFromBrowser = useCallback(async () => {
    console.log("🌍 getLocationFromBrowser called");
    
    // Prevent multiple simultaneous lookups
    if (isLookingUpRef.current) {
      console.log("⏸️ Location lookup already in progress, skipping");
      return;
    }
    
    // Limit frequency to once per minute
    const now = Date.now();
    if (now - lastLookupTimeRef.current < 60000) { // 1 minute cooldown
      console.log("⏸️ Location lookup requested too soon, skipping");
      return;
    }
    
    isLookingUpRef.current = true;
    lastLookupTimeRef.current = now;
    setHasRequestedPermission(true);
    
    console.log("🚀 Starting location lookup with validation service");
    setIsLoading(true);
    setError(null);

    try {
      // Use the location service to get GPS location with validation
      const result = await locationService.getGPSLocation();
      
      if (result.success && result.location) {
        console.log("✅ GPS location validated:", result.location.name);
        updateLocationFromValidated(result.location);
      } else {
        console.error("❌ GPS location failed:", result.error);
        setError(result.error || "Failed to get GPS location");
        
        // Try to fallback to saved location
        const fallbackResult = await locationService.resolveLocation();
        if (fallbackResult.success && fallbackResult.location) {
          console.log("🔄 Using fallback location:", fallbackResult.location.name);
          updateLocationFromValidated(fallbackResult.location);
          setError(null);
        }
      }
    } catch (error) {
      console.error("❌ Location service error:", error);
      setError("Location service error. Please try again.");
    }

    setIsLoading(false);
    isLookingUpRef.current = false;
  }, [updateLocationFromValidated]);

  // Initialize location using location service
  useEffect(() => {
    const initializeLocation = async () => {
      console.log("🔍 LocationContext: Initializing with validation service...");
      
      try {
        // Try to restore validated location from localStorage
        const savedValidated = localStorage.getItem("validatedLocation");
        if (savedValidated) {
          try {
            const parsed = JSON.parse(savedValidated) as ValidatedLocation;
            // Check if the saved location is still valid (not expired)
            if (Date.now() < parsed.expiresAt) {
              console.log("✅ Restored validated location:", parsed.name);
              updateLocationFromValidated(parsed);
              setIsLoading(false);
              return;
            } else {
              console.log("⏰ Saved location expired, clearing cache");
              localStorage.removeItem("validatedLocation");
            }
          } catch (err) {
            console.warn("⚠️ Failed to parse saved validated location:", err);
            localStorage.removeItem("validatedLocation");
          }
        }

        // No valid saved location, try to resolve using location service
        console.log("🚀 Resolving location using service hierarchy");
        const result = await locationService.resolveLocation();
        
        if (result.success && result.location) {
          console.log("✅ Location resolved:", result.location.name, "Source:", result.location.source);
          updateLocationFromValidated(result.location);
        } else {
          console.log("⚠️ No location resolved:", result.error);
          setError(result.error || null);
        }
      } catch (error) {
        console.error("❌ Location initialization error:", error);
        setError("Failed to initialize location service");
      }
      
      setIsLoading(false);
    };

    initializeLocation();
  }, [updateLocationFromValidated]);

  const requestLocationPermission = useCallback(() => {
    localStorage.setItem("locationRequested", "true");
    getLocationFromBrowser();
  }, [getLocationFromBrowser]);

  const setAdviceMode = useCallback((mode: AdviceMode) => {
    setAdviceModeState(mode);
    try {
      localStorage.setItem(ADVICE_MODE_STORAGE_KEY, mode);
    } catch (err) {
      console.error("Could not save advice mode to localStorage:", err);
    }
  }, []);

  // Create the context value using memoization to prevent unnecessary re-renders
  const value = React.useMemo(() => ({
    location,
    coordinates,
    isLoading,
    error,
    requestLocationPermission,
    hasRequestedPermission,
    validatedLocation,
    setLocation,
    locationChangeDetected,
    dismissLocationChange,
    confidence,
    source,
    adviceMode,
    setAdviceMode,
  }), [
    location,
    coordinates,
    isLoading,
    error,
    requestLocationPermission,
    hasRequestedPermission,
    validatedLocation,
    setLocation,
    locationChangeDetected,
    dismissLocationChange,
    confidence,
    source,
    adviceMode,
    setAdviceMode,
  ]);

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
