import { test } from "node:test";
import assert from "node:assert/strict";
import { planPayloadSchema, resolvePlanEvents, PlanResolutionError } from "@shared/plans";

function basePayload(events: Array<Record<string, unknown>>) {
  return planPayloadSchema.parse({ events, sources: [], summary: "test" });
}

test("offsets are measured from the plan anchor day", () => {
  const payload = basePayload([
    { title: "Soil prep", offsetDays: 0, timeOfDay: "09:00", durationHours: 3 },
    { title: "Sow seeds", offsetDays: 7, timeOfDay: "08:30", durationHours: 2 },
  ]);

  const resolved = resolvePlanEvents(payload, new Date(2026, 8, 14)); // Sep 14 2026

  assert.equal(resolved[0].startDate.getFullYear(), 2026);
  assert.equal(resolved[0].startDate.getMonth(), 8);
  assert.equal(resolved[0].startDate.getDate(), 14);
  assert.equal(resolved[0].startDate.getHours(), 9);
  assert.equal(resolved[1].startDate.getDate(), 21);
  assert.equal(resolved[1].startDate.getMinutes(), 30);
  assert.equal(resolved[1].endDate.getTime() - resolved[1].startDate.getTime(), 2 * 3600 * 1000);
});

test("dependencies chain offsets from the referenced event, not the anchor", () => {
  const payload = basePayload([
    { title: "Sow seeds", offsetDays: 5, timeOfDay: "09:00", durationHours: 2 },
    { title: "First scouting", offsetDays: 14, dependsOnIndex: 0, timeOfDay: "10:00", durationHours: 1 },
    { title: "Fertilize after scouting", offsetDays: 3, dependsOnIndex: 1, timeOfDay: "09:00", durationHours: 2 },
  ]);

  const resolved = resolvePlanEvents(payload, new Date(2026, 8, 1));

  // Sow: Sep 1 + 5 = Sep 6. Scouting: Sep 6 + 14 = Sep 20. Fertilize: Sep 20 + 3 = Sep 23.
  assert.equal(resolved[0].startDate.getDate(), 6);
  assert.equal(resolved[1].startDate.getDate(), 20);
  assert.equal(resolved[2].startDate.getDate(), 23);
});

test("an event cannot depend on itself or a later event", () => {
  const selfDep = basePayload([{ title: "Bad", offsetDays: 1, dependsOnIndex: 0 }]);
  assert.throws(() => resolvePlanEvents(selfDep, new Date(2026, 0, 1)), PlanResolutionError);

  const forwardDep = basePayload([
    { title: "First", offsetDays: 1 },
    { title: "Second", offsetDays: 1, dependsOnIndex: 1 },
  ]);
  assert.throws(() => resolvePlanEvents(forwardDep, new Date(2026, 0, 1)), PlanResolutionError);
});

test("dependency chains cross month boundaries correctly", () => {
  const payload = basePayload([
    { title: "Start", offsetDays: 0, timeOfDay: "09:00", durationHours: 1 },
    { title: "Next month", offsetDays: 25, dependsOnIndex: 0, timeOfDay: "09:00", durationHours: 1 },
  ]);

  const resolved = resolvePlanEvents(payload, new Date(2026, 8, 20)); // Sep 20 + 25 = Oct 15
  assert.equal(resolved[1].startDate.getMonth(), 9);
  assert.equal(resolved[1].startDate.getDate(), 15);
});

test("defaults apply: 09:00 start, 2 hour duration, checkWeather true", () => {
  const payload = basePayload([{ title: "Bare", offsetDays: 0 }]);
  const [event] = resolvePlanEvents(payload, new Date(2026, 0, 10));
  assert.equal(event.startDate.getHours(), 9);
  assert.equal(event.endDate.getHours(), 11);
  assert.equal(event.spec.checkWeather, true);
});

test("recurring specs survive validation round-trip", () => {
  const payload = basePayload([
    {
      title: "Weekly scouting",
      offsetDays: 0,
      recurring: { frequency: "week", interval: 1, endDate: "2026-12-31" },
    },
  ]);
  assert.equal(payload.events[0].recurring?.frequency, "week");
});

test("payloads over 100 events are rejected", () => {
  const events = Array.from({ length: 101 }, (_, i) => ({ title: `E${i}`, offsetDays: 0 }));
  assert.throws(() => planPayloadSchema.parse({ events, sources: [], summary: "" }));
});
