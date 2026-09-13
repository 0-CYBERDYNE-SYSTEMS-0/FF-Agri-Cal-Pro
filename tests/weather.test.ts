import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWeatherData } from "../server/openWeatherApi";
import { WeatherForecast } from "@shared/schema";

function forecast(overrides: Partial<WeatherForecast>): WeatherForecast {
  return {
    date: "2026-09-10",
    dayOfWeek: "Today",
    temperature: 70,
    temp_min: 55,
    temp_max: 82,
    feels_like: 68,
    weatherDescription: "Clear sky",
    icon: "☀️",
    wind: 5.2,
    humidity: 40,
    precipitation: 0,
    ...overrides,
  };
}

test("provider payload maps to the single weather wire format with US units", () => {
  const fetchedAt = "2026-09-10T12:00:00.000Z";
  const result = formatWeatherData({
    locationName: "Eugene, Oregon",
    fetchedAt,
    forecasts: [
      forecast({ date: "2026-09-10" }),
      forecast({ date: "2026-09-11", dayOfWeek: "Fri", temperature: 75, isCurrent: true }),
      forecast({ date: "2026-09-12", dayOfWeek: "Sat", temperature: 80, isCurrent: true }),
    ],
  });

  assert.equal(result.location, "Eugene, Oregon");
  assert.equal(result.fetchedAt, fetchedAt);
  // Unit metadata is explicit so clients never guess conversions
  assert.deepEqual(result.units, {
    temperature: "°F",
    wind: "mph",
    precipitation: "inches",
    visibility: "kilometers",
  });
  assert.equal(result.current.isCurrent, true);
  assert.equal(result.current.date, "2026-09-10");
  assert.equal(result.forecast.length, 2);
  for (const day of result.forecast) {
    assert.equal(day.isCurrent, false, "forecast days must not be flagged as current");
  }
  assert.equal(result.forecast[0].date, "2026-09-11");
});

test("mapping fails explicitly when the provider returns no forecast rows", () => {
  assert.throws(
    () => formatWeatherData({ locationName: "Nowhere", fetchedAt: "2026-09-10T12:00:00.000Z", forecasts: [] }),
    /No weather data available/
  );
});
