/**
 * Centralized Location Service with Validation Pipeline
 * Provides single source of truth for all location resolution
 */

export interface LocationFingerprint {
  lat: number;
  lon: number;
  timestamp: number;
  source: 'gps' | 'user_input' | 'cached' | 'fallback';
  accuracy?: number;
}

export interface ValidatedLocation {
  id: string;
  name: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  fingerprint: LocationFingerprint;
  validatedAt: number;
  expiresAt: number;
  confidence: number; // 0-1 score
  source: 'gps' | 'user_input' | 'cached' | 'fallback';
  rawInput?: string;
}

export interface LocationCacheEntry {
  location: ValidatedLocation;
  weatherData?: any;
  expiresAt: number;
}

export interface LocationValidationResult {
  success: boolean;
  location?: ValidatedLocation;
  error?: string;
  suggestedFallbacks?: ValidatedLocation[];
}

class LocationService {
  private cache = new Map<string, LocationCacheEntry>();
  private lastLocation: ValidatedLocation | null = null;
  private readonly CACHE_EXPIRY = 30 * 60 * 1000; // 30 minutes
  private readonly LOCATION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours
  private readonly MAX_RETRY_ATTEMPTS = 3;
  private readonly RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff
  
  /**
   * Main location resolution with hierarchy: explicit input → GPS → cached → fallback
   */
  async resolveLocation(input?: string): Promise<LocationValidationResult> {
    try {
      // 1. Explicit user input (highest priority)
      if (input && input.trim()) {
        const result = await this.validateLocationInput(input.trim());
        if (result.success) {
          await this.updateLastLocation(result.location!);
          return result;
        }
      }

      // 2. GPS location (if available and not too old)
      const gpsLocation = await this.getGPSLocation();
      if (gpsLocation.success) {
        await this.updateLastLocation(gpsLocation.location!);
        return gpsLocation;
      }

      // 3. Cached location (if valid and not expired)
      const cachedLocation = this.getCachedLocation();
      if (cachedLocation) {
        return { success: true, location: cachedLocation };
      }

      // 4. Fallback to default/saved location
      const fallbackLocation = this.getFallbackLocation();
      if (fallbackLocation) {
        return { success: true, location: fallbackLocation };
      }

      return {
        success: false,
        error: 'No valid location found. Please provide a location or enable GPS.'
      };

    } catch (error) {
      console.error('Location resolution error:', error);
      return {
        success: false,
        error: 'Failed to resolve location. Please try again.'
      };
    }
  }

  /**
   * Validate location input with format detection and geocoding verification
   */
  async validateLocationInput(input: string): Promise<LocationValidationResult> {
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(input);
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return { success: true, location: cached.location };
      }

      // Detect format and validate
      const format = this.detectLocationFormat(input);
      let validationResult: LocationValidationResult;

      switch (format) {
        case 'coordinates':
          validationResult = await this.validateCoordinates(input);
          break;
        case 'place_name':
          validationResult = await this.validatePlaceName(input);
          break;
        default:
          return {
            success: false,
            error: 'Invalid location format. Please provide coordinates (lat,lon) or place name.'
          };
      }

      // Cache successful validation
      if (validationResult.success && validationResult.location) {
        this.cacheLocation(cacheKey, validationResult.location);
      }

      return validationResult;

    } catch (error) {
      console.error('Location validation error:', error);
      return {
        success: false,
        error: 'Failed to validate location. Please check your input.'
      };
    }
  }

  /**
   * Detect location format (coordinates vs place name)
   */
  private detectLocationFormat(input: string): 'coordinates' | 'place_name' | 'unknown' {
    // Coordinate patterns: "lat,lon" or "lat, lon"
    const coordPattern = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
    
    if (coordPattern.test(input.trim())) {
      return 'coordinates';
    }
    
    // If it contains letters, assume it's a place name
    if (/[a-zA-Z]/.test(input)) {
      return 'place_name';
    }
    
    return 'unknown';
  }

  /**
   * Validate coordinate format and verify they're reasonable
   */
  async validateCoordinates(input: string): Promise<LocationValidationResult> {
    try {
      const parts = input.split(',').map(p => p.trim());
      if (parts.length !== 2) {
        return {
          success: false,
          error: 'Coordinates must be in format: latitude,longitude'
        };
      }

      const lat = parseFloat(parts[0]);
      const lon = parseFloat(parts[1]);

      // Validate coordinate ranges
      if (isNaN(lat) || isNaN(lon)) {
        return {
          success: false,
          error: 'Invalid coordinate values. Must be numbers.'
        };
      }

      if (lat < -90 || lat > 90) {
        return {
          success: false,
          error: 'Latitude must be between -90 and 90 degrees.'
        };
      }

      if (lon < -180 || lon > 180) {
        return {
          success: false,
          error: 'Longitude must be between -180 and 180 degrees.'
        };
      }

      // Try reverse geocoding to get place name
      const placeName = await this.reverseGeocode(lat, lon);
      
      const location: ValidatedLocation = {
        id: this.generateLocationId(lat, lon),
        name: placeName || `${lat.toFixed(6)}, ${lon.toFixed(6)}`,
        coordinates: { lat, lon },
        fingerprint: {
          lat,
          lon,
          timestamp: Date.now(),
          source: 'user_input'
        },
        validatedAt: Date.now(),
        expiresAt: Date.now() + this.LOCATION_EXPIRY,
        confidence: placeName ? 0.9 : 0.7,
        source: 'user_input',
        rawInput: input
      };

      return { success: true, location };

    } catch (error) {
      console.error('Coordinate validation error:', error);
      return {
        success: false,
        error: 'Failed to validate coordinates.'
      };
    }
  }

  /**
   * Validate place name with geocoding verification
   */
  async validatePlaceName(input: string): Promise<LocationValidationResult> {
    try {
      // Attempt geocoding with retry logic
      const geocodeResult = await this.geocodeWithRetry(input);
      
      if (!geocodeResult) {
        return {
          success: false,
          error: `Could not find location: ${input}. Please check spelling or try coordinates.`
        };
      }

      const location: ValidatedLocation = {
        id: this.generateLocationId(geocodeResult.lat, geocodeResult.lon),
        name: geocodeResult.name,
        coordinates: {
          lat: geocodeResult.lat,
          lon: geocodeResult.lon
        },
        fingerprint: {
          lat: geocodeResult.lat,
          lon: geocodeResult.lon,
          timestamp: Date.now(),
          source: 'user_input'
        },
        validatedAt: Date.now(),
        expiresAt: Date.now() + this.LOCATION_EXPIRY,
        confidence: 0.95,
        source: 'user_input',
        rawInput: input
      };

      return { success: true, location };

    } catch (error) {
      console.error('Place name validation error:', error);
      return {
        success: false,
        error: 'Failed to validate place name.'
      };
    }
  }

  /**
   * Get GPS location with exponential backoff retry
   */
  async getGPSLocation(): Promise<LocationValidationResult> {
    if (!navigator.geolocation) {
      return {
        success: false,
        error: 'Geolocation not supported by browser'
      };
    }

    return new Promise((resolve) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5 * 60 * 1000 // 5 minutes
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Try reverse geocoding for place name
          const placeName = await this.reverseGeocode(latitude, longitude);
          
          const location: ValidatedLocation = {
            id: this.generateLocationId(latitude, longitude),
            name: placeName || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
            coordinates: { lat: latitude, lon: longitude },
            fingerprint: {
              lat: latitude,
              lon: longitude,
              timestamp: Date.now(),
              source: 'gps',
              accuracy
            },
            validatedAt: Date.now(),
            expiresAt: Date.now() + this.LOCATION_EXPIRY,
            confidence: accuracy ? Math.max(0.5, 1 - (accuracy / 1000)) : 0.8,
            source: 'gps'
          };

          resolve({ success: true, location });
        },
        (error) => {
          const friendlyMessage = this.mapGeolocationError(error);
          console.warn('GPS location error:', { code: error.code, message: friendlyMessage });
          resolve({
            success: false,
            error: friendlyMessage
          });
        },
        options
      );
    });
  }

  private mapGeolocationError(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission was denied. You can enable it in your browser site settings.';
      case error.POSITION_UNAVAILABLE:
        return 'Location is currently unavailable from the browser. Try again in a moment or enter a city/town manually.';
      case error.TIMEOUT:
        return 'Timed out while trying to get your location. Please try again or enter a location manually.';
      default:
        return 'Unexpected GPS error from the browser. Try again or enter a location manually.';
    }
  }

  /**
   * Geocoding with retry logic and exponential backoff
   */
  private async geocodeWithRetry(location: string, attempt = 0): Promise<any> {
    try {
      const response = await fetch(`/api/geocode?location=${encodeURIComponent(location)}`);
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      if (attempt < this.MAX_RETRY_ATTEMPTS - 1) {
        await this.delay(this.RETRY_DELAYS[attempt]);
        return this.geocodeWithRetry(location, attempt + 1);
      }
      
      console.error(`Geocoding failed after ${this.MAX_RETRY_ATTEMPTS} attempts:`, error);
      return null;
    }
  }

  /**
   * Reverse geocoding to get place name from coordinates
   */
  private async reverseGeocode(lat: number, lon: number): Promise<string | null> {
    try {
      const response = await fetch(`/api/reverse-geocode?lat=${lat}&lon=${lon}`);
      
      if (!response.ok) {
        console.warn(`Reverse geocoding failed: ${response.status} ${response.statusText}`);
        // Return coordinates as fallback
        return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
      
      const data = await response.json();
      return data.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Return coordinates as fallback
      return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  }

  /**
   * Check for location consistency and detect changes
   */
  detectLocationChange(newLocation: ValidatedLocation): boolean {
    if (!this.lastLocation) {
      return false;
    }

    const distance = this.calculateDistance(
      this.lastLocation.coordinates,
      newLocation.coordinates
    );

    // Consider it a change if more than 1km apart
    return distance > 1000;
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: {lat: number, lon: number}, coord2: {lat: number, lon: number}): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(coord2.lat - coord1.lat);
    const dLon = this.toRadians(coord2.lon - coord1.lon);
    
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRadians(coord1.lat)) * Math.cos(this.toRadians(coord2.lat)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Cache management
   */
  private cacheLocation(key: string, location: ValidatedLocation): void {
    this.cache.set(key, {
      location,
      expiresAt: Date.now() + this.CACHE_EXPIRY
    });
  }

  private getCachedLocation(): ValidatedLocation | null {
    if (!this.lastLocation) {
      return null;
    }

    if (Date.now() > this.lastLocation.expiresAt) {
      return null;
    }

    return this.lastLocation;
  }

  private getFallbackLocation(): ValidatedLocation | null {
    try {
      const saved = localStorage.getItem('userLocation');
      if (!saved) {
        return null;
      }

      // Try to parse as existing location format
      if (saved.includes(',')) {
        const parts = saved.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          
          if (!isNaN(lat) && !isNaN(lon)) {
            return {
              id: this.generateLocationId(lat, lon),
              name: saved,
              coordinates: { lat, lon },
              fingerprint: {
                lat,
                lon,
                timestamp: Date.now(),
                source: 'fallback'
              },
              validatedAt: Date.now(),
              expiresAt: Date.now() + this.LOCATION_EXPIRY,
              confidence: 0.5,
              source: 'fallback'
            };
          }
        }
      }

      // Try as place name
      return {
        id: this.generateLocationId(0, 0),
        name: saved,
        coordinates: { lat: 0, lon: 0 },
        fingerprint: {
          lat: 0,
          lon: 0,
          timestamp: Date.now(),
          source: 'fallback'
        },
        validatedAt: Date.now(),
        expiresAt: Date.now() + this.LOCATION_EXPIRY,
        confidence: 0.3,
        source: 'fallback'
      };

    } catch (error) {
      console.error('Fallback location error:', error);
      return null;
    }
  }

  private async updateLastLocation(location: ValidatedLocation): Promise<void> {
    const hasChanged = this.detectLocationChange(location);
    
    if (hasChanged && this.lastLocation) {
      console.warn('Location change detected:', {
        from: this.lastLocation.name,
        to: location.name,
        distance: this.calculateDistance(
          this.lastLocation.coordinates,
          location.coordinates
        )
      });
    }

    this.lastLocation = location;
    
    // Save to localStorage
    try {
      localStorage.setItem('userLocation', location.name);
      localStorage.setItem('validatedLocation', JSON.stringify(location));
    } catch (error) {
      console.error('Failed to save location:', error);
    }
  }

  /**
   * Generate unique location ID
   */
  private generateLocationId(lat: number, lon: number): string {
    return `loc_${lat.toFixed(6)}_${lon.toFixed(6)}_${Date.now()}`;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(input: string): string {
    return `loc_cache_${input.toLowerCase().replace(/\s+/g, '_')}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Public API methods
   */
  getCurrentLocation(): ValidatedLocation | null {
    return this.lastLocation;
  }

  clearCache(): void {
    this.cache.clear();
    this.lastLocation = null;
    localStorage.removeItem('validatedLocation');
  }

  getLocationFingerprint(): LocationFingerprint | null {
    return this.lastLocation?.fingerprint || null;
  }

  /**
   * Health check for location services
   */
  async healthCheck(): Promise<{
    gps: boolean;
    geocoding: boolean;
    cache: boolean;
    storage: boolean;
  }> {
    const health = {
      gps: !!navigator.geolocation,
      geocoding: false,
      cache: true,
      storage: false
    };

    // Test geocoding
    try {
      const response = await fetch('/api/health/geocoding');
      health.geocoding = response.ok;
    } catch {
      health.geocoding = false;
    }

    // Test localStorage
    try {
      localStorage.setItem('health_test', 'test');
      localStorage.removeItem('health_test');
      health.storage = true;
    } catch {
      health.storage = false;
    }

    return health;
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;