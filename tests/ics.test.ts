import { test } from "node:test";
import assert from "node:assert/strict";
import { parseICS, serializeICS, planImport, unescapeIcsText, ParsedIcsEvent } from "../shared/ics";
import { expandRecurringEvents } from "../shared/recurrence";

const CRLF = "\r\n";

function calendarWith(vevent: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Test//EN",
    vevent,
    "END:VCALENDAR",
  ].join(CRLF);
}

test("round-trip preserves UTC date-times, escaped text, and the UID", () => {
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:abc-123@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260101T123000Z",
    "DTEND:20260101T133000Z",
    "SUMMARY:Plant tomatoes\\, then water\\; mulch afterwards",
    "DESCRIPTION:Line one\\nLine two with \\\\ backslash",
    "LOCATION:North Field",
    "END:VEVENT",
  ].join(CRLF));

  const { events, errors } = parseICS(ics);
  assert.deepEqual(errors, []);
  assert.equal(events.length, 1);

  const roundTripped = parseICS(serializeICS(events.map(e => ({
    ...e,
    id: 1,
  }))));
  assert.deepEqual(roundTripped.errors, []);
  assert.equal(roundTripped.events.length, 1);

  const parsed = roundTripped.events[0];
  assert.equal(parsed.uid, "abc-123@agrical.local");
  assert.equal(parsed.startDate.toISOString(), "2026-01-01T12:30:00.000Z");
  assert.equal(parsed.endDate.toISOString(), "2026-01-01T13:30:00.000Z");
  assert.equal(parsed.title, "Plant tomatoes, then water; mulch afterwards");
  assert.equal(parsed.description, "Line one\nLine two with \\ backslash");
});

test("TZID date-times convert to the correct UTC instant across DST", () => {
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:tz@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART;TZID=America/New_York:20260701T090000",
    "DTEND;TZID=America/New_York:20260701T100000",
    "SUMMARY:Morning check",
    "END:VEVENT",
  ].join(CRLF));

  const { events, errors } = parseICS(ics);
  assert.deepEqual(errors, []);
  // July is EDT (UTC-4): 09:00 local -> 13:00Z
  assert.equal(events[0].startDate.toISOString(), "2026-07-01T13:00:00.000Z");
});

test("VALUE=DATE all-day events are supported with exclusive DTEND", () => {
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:allday@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART;VALUE=DATE:20260701",
    "DTEND;VALUE=DATE:20260703",
    "SUMMARY:County fair",
    "END:VEVENT",
  ].join(CRLF));

  const { events, errors } = parseICS(ics);
  assert.deepEqual(errors, []);
  const event = events[0];
  assert.equal(event.allDay, true);
  assert.equal(event.startDate.getFullYear(), 2026);
  assert.equal(event.startDate.getMonth(), 6);
  assert.equal(event.startDate.getDate(), 1);
  assert.equal(event.startDate.getHours(), 0);
  // Two all-day days (Jul 1..Jul 2 inclusive): stored end is the last covered instant
  assert.equal(event.endDate.getMonth(), 6);
  assert.equal(event.endDate.getDate(), 2);
  assert.equal(event.endDate.getHours(), 23);

  // Serializing an all-day event keeps VALUE=DATE markers
  const serialized = serializeICS([{ ...event, id: 5 }]);
  assert.ok(serialized.includes("DTSTART;VALUE=DATE:20260701"));
  assert.ok(serialized.includes("DTEND;VALUE=DATE:20260703"));
});

test("long lines are folded at 75 octets and unfold to the original text", () => {
  const longDescription = "A".repeat(40) + " " + "B".repeat(120) + " " + "C".repeat(60);
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:fold@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260101T120000Z",
    "DTEND:20260101T130000Z",
    `DESCRIPTION:${longDescription.replace(/\n/g, "\\n")}`,
    "SUMMARY:Folded",
    "END:VEVENT",
  ].join(CRLF));

  for (const line of ics.split(CRLF)) {
    // input lines other than the folded description are short
    assert.ok(line.length <= 75 || line.startsWith("DESCRIPTION:"), `unexpected long line: ${line.length}`);
  }

  const { events, errors } = parseICS(ics);
  assert.deepEqual(errors, []);
  assert.equal(events[0].description, longDescription);

  // The serialized output must fold every line to <= 75 octets
  const serialized = serializeICS([{ ...events[0], id: 9 }]);
  for (const line of serialized.split(CRLF)) {
    assert.ok(line.length <= 75, `serialized line exceeds 75 chars: ${line.length}`);
  }
  // Round-trip through the folded serialization keeps the description
  const reparsed = parseICS(serialized);
  assert.deepEqual(reparsed.errors, []);
  assert.equal(reparsed.events[0].description, longDescription);
});

test("RRULE recurrence imports and expands with the shared engine", () => {
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:rrule@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260601T080000Z",
    "DTEND:20260601T090000Z",
    "RRULE:FREQ=DAILY;INTERVAL=2;UNTIL=20260611T080000Z",
    "SUMMARY:Irrigation",
    "END:VEVENT",
  ].join(CRLF));

  const { events, errors } = parseICS(ics);
  assert.deepEqual(errors, []);
  assert.deepEqual(events[0].recurringPattern, {
    frequency: "day",
    interval: 2,
    endDate: "2026-06-11T08:00:00.000Z",
  });

  const occurrences = expandRecurringEvents(
    events as unknown as ParsedIcsEvent[],
    new Date("2026-06-01T00:00:00Z"),
    new Date("2026-06-30T23:59:59Z")
  );
  assert.equal(occurrences.length, 6); // Jun 1, 3, 5, 7, 9, 11 (UTC)
});

test("invalid DTSTART forms are rejected per event with no silent skip", () => {
  const ics = calendarWith([
    "BEGIN:VEVENT",
    "UID:bad@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:not-a-date",
    "SUMMARY:Broken",
    "END:VEVENT",
  ].join(CRLF));

  const { events, errors } = parseICS(ics);
  assert.equal(events.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /DTSTART/);
});

test("unsupported RRULE parts and recurrence properties are rejected, not ignored", () => {
  const byDay = parseICS(calendarWith([
    "BEGIN:VEVENT",
    "UID:byday@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260601T080000Z",
    "RRULE:FREQ=WEEKLY;BYDAY=MO,WE",
    "SUMMARY:Weekly",
    "END:VEVENT",
  ].join(CRLF)));
  assert.equal(byDay.events.length, 0);
  assert.match(byDay.errors[0].message, /BYDAY/);

  const exdate = parseICS(calendarWith([
    "BEGIN:VEVENT",
    "UID:exdate@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART:20260601T080000Z",
    "RRULE:FREQ=DAILY",
    "EXDATE:20260602T080000Z",
    "SUMMARY:Daily with exceptions",
    "END:VEVENT",
  ].join(CRLF)));
  assert.equal(exdate.events.length, 0);
  assert.match(exdate.errors[0].message, /EXDATE/);
});

test("unknown TZID is rejected clearly", () => {
  const { events, errors } = parseICS(calendarWith([
    "BEGIN:VEVENT",
    "UID:tz@agrical.local",
    "DTSTAMP:20260101T000000Z",
    "DTSTART;TZID=Mars/Olympus:20260701T090000",
    "SUMMARY:Off world",
    "END:VEVENT",
  ].join(CRLF)));
  assert.equal(events.length, 0);
  assert.match(errors[0].message, /TZID/);
});

test("repeat import plans skip existing UIDs instead of duplicating", () => {
  const parsed: ParsedIcsEvent[] = [
    {
      uid: "dup@agrical.local",
      title: "Already imported",
      description: null,
      location: null,
      startDate: new Date("2026-07-01T12:00:00Z"),
      endDate: new Date("2026-07-01T13:00:00Z"),
      allDay: false,
      checkWeather: false,
      recurringPattern: null,
    },
    {
      uid: "new@agrical.local",
      title: "Fresh event",
      description: null,
      location: null,
      startDate: new Date("2026-07-02T12:00:00Z"),
      endDate: new Date("2026-07-02T13:00:00Z"),
      allDay: false,
      checkWeather: false,
      recurringPattern: null,
    },
  ];

  const { toCreate, duplicates } = planImport(parsed, ["dup@agrical.local"]);
  assert.equal(toCreate.length, 1);
  assert.equal(toCreate[0].uid, "new@agrical.local");
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].uid, "dup@agrical.local");
});

test("unescaping handles the documented escape set", () => {
  assert.equal(unescapeIcsText("a\\,b\\;c\\\\d\\ne"), "a,b;c\\d\ne");
});
