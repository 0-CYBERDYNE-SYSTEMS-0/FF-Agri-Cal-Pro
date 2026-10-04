import { test } from "node:test";
import assert from "node:assert/strict";
import axios from "axios";
import { assessFrostRisk, accumulateGrowingDegreeDays, evaluateCropGrowingDegreeDays } from "../server/frostGdd";
import { fetchGrowingDegreeWeather } from "../server/openWeatherApi";

test("frost rule flags freezing forecast lows and accepts a warmer dry day", () => {
  const risk = assessFrostRisk(
    { title: "Transplant tomatoes", description: null },
    { date: "2026-09-15", tempMin: 32, description: "Frost" }
  );

  assert.ok(risk);
  assert.match(risk.reason, /frost risk/);
  assert.equal(risk.evidence.tempMinF, 32);
  assert.equal(risk.isSuitable({ tempMin: 45, precipitation: 0 }), true);
  assert.equal(risk.isSuitable({ tempMin: 45, precipitation: 0.2 }), false);
});

test("frost rule ignores forecast lows above freezing", () => {
  assert.equal(
    assessFrostRisk(
      { title: "Plant lettuce", description: "Outdoor bed" },
      { date: "2026-09-15", tempMin: 33, description: "Clear" }
    ),
    null
  );
});

test("growing degree accumulation uses the standard base and floors cold days at zero", () => {
  assert.equal(accumulateGrowingDegreeDays([
    { date: "2026-09-01", tempMin: 40, tempMax: 70 },
    { date: "2026-09-02", tempMin: 35, tempMax: 45 },
  ]), 5);
});

test("growing degree proposal is an estimate from planting through the supplied weather data", () => {
  const proposal = evaluateCropGrowingDegreeDays(
    { id: 7, name: "Tomatoes", plantedAt: new Date("2026-09-02T00:00:00Z") },
    [
      { date: "2026-09-01", tempMin: 40, tempMax: 70 },
      { date: "2026-09-02", tempMin: 50, tempMax: 80 },
    ]
  );

  assert.ok(proposal);
  assert.equal(proposal.type, "info");
  assert.equal(proposal.eventId, null);
  assert.deepEqual(proposal.changeset, []);
  assert.equal(proposal.evidence.accumulatedGdd, 15);
  assert.match(proposal.rationale, /estimate/);
  assert.match(proposal.rationale, /not a crop maturity/);
});

test("growing degree weather uses Open-Meteo daily min/max history in Fahrenheit", async () => {
  const originalGet = axios.get;
  let seenUrl = "";
  let seenParams: Record<string, unknown> | undefined;
  (axios as any).get = async (url: string, config: { params: Record<string, unknown> }) => {
    seenUrl = url;
    seenParams = config.params;
    return {
      data: {
        daily: {
          time: ["2026-09-01", "2026-09-02"],
          temperature_2m_min: [50, 55],
          temperature_2m_max: [80, 85],
        },
      },
    };
  };
  try {
    const days = await fetchGrowingDegreeWeather(
      { lat: 44.05, lon: -123.09 },
      new Date("2026-09-01T00:00:00Z"),
      new Date("2026-09-02T00:00:00Z")
    );
    assert.deepEqual(days, [
      { date: "2026-09-01", tempMin: 50, tempMax: 80 },
      { date: "2026-09-02", tempMin: 55, tempMax: 85 },
    ]);
    assert.match(seenUrl, /archive-api\.open-meteo\.com\/v1\/archive/);
    assert.deepEqual(seenParams, {
      latitude: 44.05,
      longitude: -123.09,
      start_date: "2026-09-01",
      end_date: "2026-09-02",
      daily: "temperature_2m_min,temperature_2m_max",
      temperature_unit: "fahrenheit",
      timezone: "auto",
    });
  } finally {
    axios.get = originalGet;
  }
});
