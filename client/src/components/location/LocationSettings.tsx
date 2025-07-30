import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "@/contexts/LocationContext";
import { locationService } from "@/lib/locationService";
import { MapPin, RefreshCw, Check, AlertCircle, Shield, Info, Clock, RotateCcw } from "lucide-react";

interface LocationSettingsProps {
  onLocationChange?: (location: string) => void;
}

export default function LocationSettings({ onLocationChange }: LocationSettingsProps) {
  const { 
    location: userLocation, 
    requestLocationPermission, 
    isLoading, 
    error,
    validatedLocation,
    setLocation,
    locationChangeDetected,
    dismissLocationChange,
    confidence,
    source
  } = useLocation();
  
  const [customLocation, setCustomLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("auto");
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  // Popular cities for quick selection
  const popularCities = [
    "New York, NY, US",
    "Los Angeles, CA, US", 
    "Chicago, IL, US",
    "Houston, TX, US",
    "Phoenix, AZ, US",
    "Philadelphia, PA, US",
    "San Antonio, TX, US",
    "San Diego, CA, US",
    "Dallas, TX, US",
    "San Jose, CA, US",
    "Austin, TX, US",
    "Jacksonville, FL, US",
    "Fort Worth, TX, US",
    "Columbus, OH, US",
    "Charlotte, NC, US",
    "San Francisco, CA, US",
    "Indianapolis, IN, US",
    "Seattle, WA, US",
    "Denver, CO, US",
    "Boston, MA, US"
  ];

  useEffect(() => {
    // Initialize with current location preference
    const savedLocation = localStorage.getItem("userLocation");
    if (userLocation) {
      setSelectedLocation("auto");
    } else if (savedLocation && savedLocation !== "New York") {
      setSelectedLocation("custom");
      setCustomLocation(savedLocation);
    }
  }, [userLocation]);

  useEffect(() => {
    // Clear success message after 3 seconds
    if (savedSuccessfully) {
      const timer = setTimeout(() => setSavedSuccessfully(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [savedSuccessfully]);

  useEffect(() => {
    // Check service health on mount
    const checkHealth = async () => {
      try {
        const health = await locationService.healthCheck();
        setHealthStatus(health);
      } catch (error) {
        console.error("Health check failed:", error);
      }
    };
    checkHealth();
  }, []);

  const validateLocationEnhanced = async (location: string): Promise<boolean> => {
    if (!location.trim()) return false;
    
    setIsValidating(true);
    setValidationError(null);
    
    try {
      // Use the enhanced location service for validation
      const result = await locationService.validateLocationInput(location);
      
      if (result.success) {
        setIsValidating(false);
        return true;
      } else {
        setValidationError(result.error || "Location validation failed");
        setIsValidating(false);
        return false;
      }
    } catch (err) {
      setValidationError("Unable to validate location. Please check your internet connection.");
      setIsValidating(false);
      return false;
    }
  };

  const handleLocationTypeChange = (value: string) => {
    setSelectedLocation(value);
    setValidationError(null);
    setSavedSuccessfully(false);
    
    if (value === "auto") {
      if (!userLocation) {
        requestLocationPermission();
      }
    }
  };

  const handleCustomLocationChange = (value: string) => {
    setCustomLocation(value);
    setValidationError(null);
    setSavedSuccessfully(false);
  };

  const handleQuickLocationSelect = (location: string) => {
    setCustomLocation(location);
    setSelectedLocation("custom");
    setValidationError(null);
    setSavedSuccessfully(false);
  };

  const handleSave = async () => {
    let locationToSave = "";
    
    if (selectedLocation === "auto") {
      if (!userLocation) {
        setValidationError("Please enable location access first or choose a custom location.");
        return;
      }
      locationToSave = userLocation;
    } else if (selectedLocation === "custom") {
      if (!customLocation.trim()) {
        setValidationError("Please enter a location.");
        return;
      }
      
      // Use enhanced validation
      const result = await setLocation(customLocation.trim());
      if (!result.success) {
        setValidationError(result.error || "Failed to validate location");
        return;
      }
      
      locationToSave = customLocation.trim();
    }
    
    setSavedSuccessfully(true);
    setValidationError(null);
    
    // Call parent callback if provided
    if (onLocationChange) {
      onLocationChange(locationToSave);
    }
    
    console.log("Location preference saved:", locationToSave);
  };

  const handleRequestLocation = () => {
    requestLocationPermission();
    setSelectedLocation("auto");
  };

  const handleClearCache = () => {
    locationService.clearCache();
    setSavedSuccessfully(false);
    setValidationError("Location cache cleared. Next location request will be fresh.");
  };

  const getConfidenceBadge = () => {
    if (!validatedLocation || confidence === 0) return null;
    
    const confidencePercent = Math.round(confidence * 100);
    let variant: "default" | "secondary" | "destructive" | "outline" = "default";
    
    if (confidence >= 0.8) variant = "default";
    else if (confidence >= 0.6) variant = "secondary";
    else variant = "outline";
    
    return (
      <Badge variant={variant} className="ml-2">
        <Shield className="h-3 w-3 mr-1" />
        {confidencePercent}% confidence
      </Badge>
    );
  };

  const getSourceBadge = () => {
    if (!source) return null;
    
    const sourceLabels = {
      gps: { label: "GPS", icon: "🛰️" },
      user_input: { label: "Manual", icon: "✏️" },
      cached: { label: "Cached", icon: "💾" },
      fallback: { label: "Fallback", icon: "🔄" }
    };
    
    const sourceInfo = sourceLabels[source];
    
    return (
      <Badge variant="outline" className="ml-2">
        <span className="mr-1">{sourceInfo.icon}</span>
        {sourceInfo.label}
      </Badge>
    );
  };

  const getCurrentLocationDisplay = () => {
    if (validatedLocation) {
      return (
        <div className="flex items-center justify-between">
          <span>📍 {validatedLocation.name}</span>
          <div className="flex items-center">
            {getSourceBadge()}
            {getConfidenceBadge()}
          </div>
        </div>
      );
    }
    
    const savedLocation = localStorage.getItem("userLocation");
    
    if (userLocation && userLocation !== "New York") {
      return `📍 ${userLocation}`;
    } else if (savedLocation && savedLocation !== "New York") {
      return `📍 ${savedLocation}`;
    } else {
      return "No location set";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Settings
        </CardTitle>
        <p className="text-sm text-gray-600">
          Set your location to get accurate weather information and local recommendations.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Location Change Detection Alert */}
        {locationChangeDetected && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Location change detected. Please confirm your current location.</span>
              <Button variant="outline" size="sm" onClick={dismissLocationChange}>
                Dismiss
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Service Health Status */}
        {healthStatus && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-sm font-medium mb-2">Service Status</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className={`flex items-center gap-1 ${healthStatus.gps ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${healthStatus.gps ? 'bg-green-500' : 'bg-red-500'}`} />
                GPS {healthStatus.gps ? 'Available' : 'Unavailable'}
              </div>
              <div className={`flex items-center gap-1 ${healthStatus.geocoding ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${healthStatus.geocoding ? 'bg-green-500' : 'bg-red-500'}`} />
                Geocoding {healthStatus.geocoding ? 'Online' : 'Offline'}
              </div>
              <div className={`flex items-center gap-1 ${healthStatus.storage ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${healthStatus.storage ? 'bg-green-500' : 'bg-red-500'}`} />
                Storage {healthStatus.storage ? 'Available' : 'Unavailable'}
              </div>
              <div className={`flex items-center gap-1 ${healthStatus.cache ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${healthStatus.cache ? 'bg-green-500' : 'bg-red-500'}`} />
                Cache {healthStatus.cache ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>
        )}

        {/* Current Location Display */}
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-sm font-medium mb-1">Current Location</p>
          <div className="text-sm text-gray-700">
            {getCurrentLocationDisplay()}
          </div>
          {validatedLocation && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Validated {new Date(validatedLocation.validatedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Location Type Selection */}
        <div className="space-y-3">
          <Label>Location Source</Label>
          <Select value={selectedLocation} onValueChange={handleLocationTypeChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">🌍 Use my current location (GPS)</SelectItem>
              <SelectItem value="custom">📍 Set custom location</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* GPS Location Section */}
        {selectedLocation === "auto" && (
          <div className="space-y-3">
            {!userLocation ? (
              <div className="space-y-3">
                <Alert>
                  <MapPin className="h-4 w-4" />
                  <AlertDescription>
                    Location access is required to automatically detect your location.
                  </AlertDescription>
                </Alert>
                <Button 
                  onClick={handleRequestLocation} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Getting location...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Enable Location Access
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <Alert>
                <Check className="h-4 w-4" />
                <AlertDescription>
                  Location detected: {userLocation}
                </AlertDescription>
              </Alert>
            )}
            
            {error && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Custom Location Section */}
        {selectedLocation === "custom" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-location">Enter Location</Label>
              <Input
                id="custom-location"
                placeholder="e.g., San Francisco, CA or 37.7749,-122.4194"
                value={customLocation}
                onChange={(e) => handleCustomLocationChange(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Enter city name, state/country or coordinates (lat,lon) for best results
              </p>
            </div>

            {/* Quick Selection */}
            <div className="space-y-2">
              <Label>Quick Select</Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                {popularCities.map((city) => (
                  <Button
                    key={city}
                    variant="outline"
                    size="sm"
                    className="justify-start text-xs"
                    onClick={() => handleQuickLocationSelect(city)}
                  >
                    {city.split(',')[0]}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Validation Messages */}
        {validationError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {savedSuccessfully && (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>Location preference saved successfully!</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          <Button 
            onClick={handleSave} 
            disabled={isValidating || isLoading}
            className="w-full"
          >
            {isValidating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Validating location...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Location Preference
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={handleClearCache}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Clear Location Cache
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}