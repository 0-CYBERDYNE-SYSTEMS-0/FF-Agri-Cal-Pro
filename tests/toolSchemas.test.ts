process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEventToolSchema,
  updateEventToolSchema,
  updateEventRouteSchema,
  updateProjectRouteSchema,
} from "../server/toolSchemas";

test("an update of only a title succeeds without creation fields", () => {
  const parsed = updateEventRouteSchema.parse({ title: "New title only" });
  assert.deepEqual(parsed, { title: "New title only" });
});

test("updates accept partial supported fields and coerce dates at the boundary", () => {
  const parsed = updateEventRouteSchema.parse({
    startDate: "2026-09-15T08:00:00.000Z",
    checkWeather: true,
  });
  assert.ok(parsed.startDate instanceof Date);
  assert.equal(parsed.startDate.toISOString(), "2026-09-15T08:00:00.000Z");
  assert.equal(parsed.checkWeather, true);
  assert.equal(parsed.title, undefined);
});

test("update bodies cannot change ownership or internal IDs", () => {
  assert.throws(() => updateEventRouteSchema.parse({ title: "X", userId: 2 }));
  assert.throws(() => updateEventRouteSchema.parse({ id: 99 }));
  assert.throws(() => updateEventRouteSchema.parse({ createdAt: new Date().toISOString() }));
  assert.throws(() => updateEventToolSchema.parse({ eventId: 1, userId: 3 }));
  assert.throws(() => updateProjectRouteSchema.parse({ name: "N", userId: 3 }));
});

test("create tool schema requires title and dates but update does not", () => {
  assert.ok(createEventToolSchema.safeParse({ title: "T", startDate: "2026-01-01T10:00:00Z", endDate: "2026-01-01T11:00:00Z" }).success);
  assert.ok(!createEventToolSchema.safeParse({ title: "T" }).success);
  assert.ok(!updateEventToolSchema.safeParse({ title: "T" }).success, "tool updates require eventId");
  assert.ok(updateEventToolSchema.safeParse({ eventId: 7, location: "Greenhouse" }).success);
});

test("create tool schema coerces date strings and rejects unknown fields", () => {
  const parsed = createEventToolSchema.parse({
    title: "Turn compost",
    startDate: "2026-04-02T09:00:00Z",
    endDate: "2026-04-02T10:00:00Z",
    checkWeather: true,
  });
  assert.ok(parsed.startDate instanceof Date);
  assert.throws(() =>
    createEventToolSchema.parse({
      title: "Bad",
      startDate: "2026-04-02T09:00:00Z",
      endDate: "2026-04-02T10:00:00Z",
      userId: 1,
    })
  );
});
