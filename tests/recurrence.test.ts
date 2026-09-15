process.env.TZ = "America/New_York";

import { test } from "node:test";
import assert from "node:assert/strict";
import { expandRecurringEvents, RecurrenceSource } from "../shared/recurrence";
import { getEventsForDay } from "../client/src/lib/calendarUtils";

function makeEvent(overrides: Partial<RecurrenceSource> & { startDate: Date; endDate: Date }): RecurrenceSource {
  return {
    isRecurring: false,
    recurringPattern: null,
    ...overrides,
  };
}

test("a daily series started more than 500 days ago still yields occurrences in the current range", () => {
  const start = new Date(2024, 0, 1, 9, 0, 0); // ~2.7 years before the range
  const event = makeEvent({
    startDate: start,
    endDate: new Date(start.getTime() + 60 * 60 * 1000),
    isRecurring: true,
    recurringPattern: { frequency: "day", interval: 1, endDate: null },
  });

  const rangeStart = new Date(2026, 8, 1, 0, 0, 0);
  const rangeEnd = new Date(2026, 8, 10, 23, 59, 59);
  const occurrences = expandRecurringEvents([event], rangeStart, rangeEnd);

  assert.equal(occurrences.length, 10);
  for (let day = 1; day <= 10; day++) {
    const occurrence = occurrences.find(o => o.instanceDate.getDate() === day);
    assert.ok(occurrence, `expected an occurrence on Sep ${day}`);
    assert.equal(occurrence!.isRecurrenceInstance, true);
    assert.equal(new Date(occurrence!.startDate).getHours(), 9);
  }
});

test("January 31 monthly recurrence clamps to the last day of short months and never drifts", () => {
  const event = makeEvent({
    startDate: new Date(2026, 0, 31, 10, 0, 0),
    endDate: new Date(2026, 0, 31, 11, 0, 0),
    isRecurring: true,
    recurringPattern: { frequency: "month", interval: 1, endDate: null },
  });

  const occurrences = expandRecurringEvents(
    [event],
    new Date(2026, 1, 1),              // Feb 1
    new Date(2026, 3, 30, 23, 59, 59)  // Apr 30 end of day
  );

  const dates = occurrences.map(o => new Date(o.startDate));
  assert.equal(dates.length, 3);
  assert.deepEqual(
    dates.map(d => `${d.getMonth() + 1}-${d.getDate()}`),
    ["2-28", "3-31", "4-30"]
  );
});

test("leap-day yearly recurrence falls back to Feb 28 in non-leap years", () => {
  const event = makeEvent({
    startDate: new Date(2024, 1, 29, 8, 0, 0),
    endDate: new Date(2024, 1, 29, 9, 0, 0),
    isRecurring: true,
    recurringPattern: { frequency: "year", interval: 1, endDate: null },
  });

  const occurrences = expandRecurringEvents(
    [event],
    new Date(2025, 0, 1),
    new Date(2029, 11, 31)
  );

  const dates = occurrences.map(o => new Date(o.startDate));
  assert.deepEqual(
    dates.map(d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`),
    ["2025-2-28", "2026-2-28", "2027-2-28", "2028-2-29", "2029-2-28"]
  );
});

test("daily occurrences keep local wall time across the spring DST transition", () => {
  // 2026-03-08 is the US spring-forward date in America/New_York (local day is 23h)
  const event = makeEvent({
    startDate: new Date(2026, 2, 7, 9, 0, 0),
    endDate: new Date(2026, 2, 7, 10, 0, 0),
    isRecurring: true,
    recurringPattern: { frequency: "day", interval: 1, endDate: null },
  });

  const occurrences = expandRecurringEvents(
    [event],
    new Date(2026, 2, 6),
    new Date(2026, 2, 11, 23, 59, 59)
  );

  // Mar 7 (series start) through Mar 11, each at 09:00 local
  assert.equal(occurrences.length, 5);
  for (const occurrence of occurrences) {
    const start = new Date(occurrence.startDate);
    assert.equal(start.getHours(), 9, `occurrence on ${start.toDateString()} must stay at 9:00 local`);
    assert.equal(start.getMinutes(), 0);
  }
  // The occurrence immediately after the transition must be a full local day later,
  // not exactly 24h in UTC ms (which would land at 10:00 local).
  const before = occurrences.find(o => new Date(o.startDate).getDate() === 7)!;
  const after = occurrences.find(o => new Date(o.startDate).getDate() === 8)!;
  assert.notEqual(new Date(after.startDate).getTime() - new Date(before.startDate).getTime(), 24 * 60 * 60 * 1000);
});

test("a multi-day occurrence appears on each visible day it overlaps", () => {
  const event = makeEvent({
    startDate: new Date(2026, 0, 30, 10, 0, 0),
    endDate: new Date(2026, 1, 2, 12, 0, 0), // spans Jan 30 .. Feb 2
  });

  // Range is a single day after the event start: overlap must include it
  const occurrences = expandRecurringEvents(
    [event],
    new Date(2026, 1, 1),
    new Date(2026, 1, 1, 23, 59, 59)
  );
  assert.equal(occurrences.length, 1);

  const expanded = occurrences[0];
  assert.ok(getEventsForDay([expanded], new Date(2026, 0, 31)).length === 1, "Jan 31 shows the event");
  assert.ok(getEventsForDay([expanded], new Date(2026, 1, 1)).length === 1, "Feb 1 shows the event");
  assert.ok(getEventsForDay([expanded], new Date(2026, 1, 2)).length === 1, "Feb 2 shows the event");
  assert.ok(getEventsForDay([expanded], new Date(2026, 0, 29)).length === 0, "Jan 29 does not");
  assert.ok(getEventsForDay([expanded], new Date(2026, 1, 3)).length === 0, "Feb 3 does not");
});

test("pattern endDate stops the series", () => {
  const event = makeEvent({
    startDate: new Date(2026, 5, 1, 7, 0, 0),
    endDate: new Date(2026, 5, 1, 8, 0, 0),
    isRecurring: true,
    recurringPattern: {
      frequency: "day",
      interval: 1,
      endDate: new Date(2026, 5, 3).toISOString(),
    },
  });

  const occurrences = expandRecurringEvents(
    [event],
    new Date(2026, 0, 1),
    new Date(2026, 11, 31)
  );
  assert.equal(occurrences.length, 3);
});
