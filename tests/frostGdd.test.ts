import { test } from "node:test";
import assert from "node:assert/strict";
import { assessFrostRisk } from "../server/frostGdd";

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
