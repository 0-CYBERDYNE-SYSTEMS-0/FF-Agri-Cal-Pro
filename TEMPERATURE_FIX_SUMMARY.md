# Temperature & Location Display Fix

## 🔴 Issues Fixed

### Issue 1: Temperature Showing Celsius as Fahrenheit
**Problem**: Displaying 15.7°F when actual temperature was ~60°F  
**Root Cause**: Open-Meteo API returns Celsius by default, we weren't requesting Fahrenheit  
**Fix**: Added `temperature_unit: 'fahrenheit'` to API parameters

### Issue 2: Calendar Sidebar Not Showing City/State
**Problem**: Calendar weather sidebar showed no location name  
**Root Cause**: Not passing `resolvedLocationName` from useWeather hook  
**Fix**: Extract and pass `resolvedLocationName` to WeatherRow component

---

## ✅ What Changed

### File 1: `server/openWeatherApi.ts` (line 218)
Added US unit specifications to Open-Meteo API:
```javascript
const params = {
  latitude: lat,
  longitude: lon,
  current_weather: true,
  temperature_unit: 'fahrenheit',  // ✅ NEW
  windspeed_unit: 'mph',           // ✅ NEW  
  precipitation_unit: 'inch',      // ✅ NEW
  daily: 'weathercode,temperature_2m_max,...',
  hourly: 'apparent_temperature,...',
  timezone: 'auto',
};
```

### File 2: `client/src/pages/Calendar.tsx`
```javascript
// Extract resolvedLocationName (line 43)
const { weatherData, isLoading, resolvedLocationName } = useWeather(location);

// Pass to WeatherRow (line 113)
<WeatherRow 
  forecasts={weatherData}
  location={location}
  resolvedLocationName={resolvedLocationName}  // ✅ NEW
  vertical={true}
/>
```

### File 3: `client/src/components/weather/WeatherRow.tsx`
```javascript
// Add prop to interface (line 10)
interface WeatherRowProps {
  forecasts: WeatherForecast[];
  location?: string | null;
  resolvedLocationName?: string | null;  // ✅ NEW
  vertical?: boolean;
}

// Use resolved name (line 48)
const displayLocation = resolvedLocationName || getLocationName(location);
```

---

## 🧪 How to Test

### 1. Start the server
```bash
cd /Users/scrimwiggins/FF-Agri-Cal-Pro
npm run dev
```

### 2. Test Temperature via API
```bash
curl "http://localhost:3000/api/weather?lat=45.5152&lon=-122.6784" | jq '.forecasts[0].temperature'
# Should return: 55-65°F (reasonable for Portland)
# NOT: 13-17°F (Celsius values)
```

### 3. Test Weather Page
- Navigate to `/weather`
- Should see:
  - ✅ Location: "Portland, Oregon" (not coordinates)
  - ✅ Temperature: ~60°F (not ~15°F)
  - ✅ Wind: ~5-15 mph (reasonable values)
  - ✅ Precipitation: 0.0-0.5 inches (not mm)

### 4. Test Calendar Page (THE KEY TEST)
- Navigate to `/` (home/calendar)
- Look at RIGHT SIDEBAR "Weather Forecast" section
- Should see:
  - ✅ **"Portland, Oregon"** header (not blank, not coordinates)
  - ✅ Current Weather: ~60°F (not ~15°F)
  - ✅ 5-day forecast with correct temps
  
### 5. Click "Get Location" button
- Calendar sidebar should update with your GPS location
- Should show city/state name (e.g., "Eugene, Oregon")
- Temperature should be accurate for your location

---

## 📊 Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Temperature** | 15.7°F ❌ | ~60°F ✅ |
| **Wind Speed** | 8 km/h ❌ | 5 mph ✅ |
| **Precipitation** | 0.2 mm ❌ | 0.01 inches ✅ |
| **Calendar Location** | (blank) ❌ | Portland, Oregon ✅ |
| **Weather Location** | Portland, Oregon ✅ | Portland, Oregon ✅ |

---

## 🎯 Expected Values (Portland, OR in January)

- **Temperature**: 40-60°F (typical winter range)
- **Wind**: 5-15 mph (normal)
- **Precipitation**: 0.0-0.5 inches (winter rain)
- **Location**: "Portland, Oregon" or "Eugene, Oregon" etc.

If you see:
- Temps < 30°F → Still might be Celsius
- Temps > 80°F → Check if it's summer or API issue
- "44.17, -122.22" → Reverse geocoding didn't work

---

## 🔧 Why This Happened

**Open-Meteo API Defaults**:
- Temperature: Celsius (metric)
- Wind: km/h (metric)
- Precipitation: mm (metric)

**Our Code**: Was using these values directly without:
1. Requesting US units in API params ✅ NOW FIXED
2. Converting values manually

**Solution**: Added unit specifications to API request, so Open-Meteo returns Fahrenheit, mph, and inches directly.

---

## ✨ Commit

```
5970f67 - fix: correct temperature units to Fahrenheit and display location names on Calendar
```

**Status**: ✅ READY TO TEST

---

**Next Step**: Start server with `npm run dev` and verify both Weather page and Calendar sidebar show correct temperatures and location names!
