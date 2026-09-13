import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateWeatherWatch, detectLocationConflicts, type WatchEvent, type WatchForecastDay } from "../server/weatherWatch";

const NOW = new Date(2026, 8, 10, 8, 0); // Sep 10 2026, 8:00 AM

function forecastDay(overrides: Partial<WatchForecastDay> & { date: string }): WatchForecastDay {
  return {
    precipitation: 0,
    precipitationProbability: 10,
    tempMin: 50,
    tempMax: 75,
    windMax: 8,
    description: "Clear",
    ...overrides,
  };
}

function event(overrides: Partial<WatchEvent> & { id: number; day: string }): WatchEvent {
  const [y, m, d] = overrides.day.split("-").map(Number);
  const startDate = new Date(y, m - 1, d, 9, 0);
  return {
    title: "Plant cover crops",
    description: null,
    startDate,
    endDate: new Date(startDate.getTime() + 2 * 3600 * 1000),
    checkWeather: true,
    ...overrides,
  } as WatchEvent;
}

test("rain risk proposes moving to the next suitable day, preserving time and duration", () => {
  const planting = event({ id: 1, day: "2026-09-15" });
  const forecast = [
    forecastDay({ date: "2026-09-14" }),
    forecastDay({ date: "2026-09-15", precipitation: 0.8, precipitationProbability: 80, description: "Heavy rain" }),
    forecastDay({ date: "2026-09-16", precipitation: 0.3, precipitationProbability: 55, description: "Showers" }), // still bad
    forecastDay({ date: "2026-09-17", precipitation: 0, precipitationProbability: 15, description: "Clear" }), // good
    forecastDay({ date: "2026-09-18" }),
  ];

  const drafts = evaluateWeatherWatch([planting], forecast, NOW);

  assert.equal(drafts.length, 1);
  const draft = drafts[0];
  assert.equal(draft.type, "weather_risk");
  assert.equal(draft.changeset[0].eventId, 1);
  const newStart = new Date(draft.changeset[0].updates.startDate);
  const newEnd = new Date(draft.changeset[0].updates.endDate);
  assert.equal(newStart.getFullYear(), 2026);
  assert.equal(newStart.getMonth(), 8);
  assert.equal(newStart.getDate(), 17); // skipped the still-wet 16th
  assert.equal(newStart.getHours(), 9); // same time of day
  assert.equal(newEnd.getTime() - newStart.getTime(), 2 * 3600 * 1000); // same duration
  assert.match(draft.rationale, /rain/);
});

test("frost risk moves past freezing nights", () => {
  const transplant = event({ id: 2, day: "2026-09-15", title: "Transplant tomatoes" });
  const forecast = [
    forecastDay({ date: "2026-09-15", tempMin: 29, description: "Frost" }),
    forecastDay({ date: "2026-09-16", tempMin: 31, description: "Cold" }), // still freezing
    forecastDay({ date: "2026-09-17", tempMin: 38 }),
  ];

  const drafts = evaluateWeatherWatch([transplant], forecast, NOW);
  assert.equal(drafts.length, 1);
  const newStart = new Date(drafts[0].changeset[0].updates.startDate);
  assert.equal(newStart.getDate(), 17);
  assert.match(drafts[0].rationale, /frost/);
});

test("wind rule applies only to spraying tasks", () => {
  const spraying = event({ id: 3, day: "2026-09-15", title: "Spray foliar fertilizer" });
  const tilling = event({ id: 4, day: "2026-09-15", title: "Till north field" });
  const forecast = [
    forecastDay({ date: "2026-09-15", windMax: 30, description: "Very windy" }),
    forecastDay({ date: "2026-09-16", windMax: 10 }),
  ];

  const drafts = evaluateWeatherWatch([spraying, tilling], forecast, NOW);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].eventId, 3);
});

test("no suitable future day means no proposal (nothing to auto-move to)", () => {
  const planting = event({ id: 5, day: "2026-09-18" });
  const forecast = [
    forecastDay({ date: "2026-09-18", precipitation: 1.2, precipitationProbability: 90 }),
    forecastDay({ date: "2026-09-19", precipitation: 0.9, precipitationProbability: 85 }),
  ];
  assert.equal(evaluateWeatherWatch([planting], forecast, NOW).length, 0);
});

test("events outside the forecast horizon or in the past are ignored", () => {
  const past = event({ id: 6, day: "2026-09-09" }); // before NOW
  const beyond = event({ id: 7, day: "2026-10-01" }); // no forecast row
  const forecast = [forecastDay({ date: "2026-09-15", precipitation: 2 })];
  assert.equal(evaluateWeatherWatch([past, beyond], forecast, NOW).length, 0);
});

test("events without checkWeather are never moved", () => {
  const office = event({ id: 8, day: "2026-09-15", checkWeather: false });
  const forecast = [forecastDay({ date: "2026-09-15", precipitation: 2 }), forecastDay({ date: "2026-09-16" })];
  assert.equal(evaluateWeatherWatch([office], forecast, NOW).length, 0);
});

test("detectLocationConflicts flags same-place overlaps of 30+ minutes", () => {
  const events = [
    { id: 1, title: "Milk cows", startDate: new Date(2026, 8, 15, 9, 0), endDate: new Date(2026, 8, 15, 10, 30), location: "Dairy barn", allDay: false },
    { id: 2, title: "Repair stanchion", startDate: new Date(2026, 8, 15, 10, 0), endDate: new Date(2026, 8, 15, 11, 0), location: "Dairy Barn", allDay: false }, // case-insensitive place, 30min overlap
    { id: 3, title: "Different place", startDate: new Date(2026, 8, 15, 9, 0), endDate: new Date(2026, 8, 15, 12, 0), location: "Shop", allDay: false },
    { id: 4, title: "Tiny overlap", startDate: new Date(2026, 8, 15, 10, 55), endDate: new Date(2026, 8, 15, 11, 30), location: "Dairy barn", allDay: false }, // 5 min with #2
    { id: 5, title: "All day thing", startDate: new Date(2026, 8, 15, 0, 0), endDate: new Date(2026, 8, 15, 23, 0), location: "Dairy barn", allDay: true },
  ];

  const conflicts = detectLocationConflicts(events);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].type, "conflict");
  assert.deepEqual(conflicts[0].changeset, []); // human decides; no auto-move
  assert.equal((conflicts[0].evidence as any).overlapMinutes, 30);
});
