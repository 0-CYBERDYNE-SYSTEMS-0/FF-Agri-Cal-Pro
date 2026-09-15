// Single ICS (RFC 5545) parse + serialize implementation shared by the server
// import/export routes and the client calendar export.
//
// Semantics (explicit):
// - UTC values (trailing Z), TZID-qualified local times, all-day DATE values,
//   and floating local times are all parsed. Floating times are interpreted in
//   the server/browser local time zone.
// - Unsupported or invalid DTSTART/DTEND forms and unsupported RRULE parts are
//   rejected with a per-event error; nothing is silently skipped.
// - Text is escaped/unescaped per RFC 5545 and long lines are folded at
//   75 octets on serialize and unfolded on parse.
// - Imported events keep their UID so repeat imports can be de-duplicated.

import type { RecurringPattern } from "./recurrence";

export interface ParsedIcsEvent {
  uid: string | null;
  title: string;
  description: string | null;
  location: string | null;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  checkWeather: boolean;
  isRecurring: boolean;
  recurringPattern: RecurringPattern | null;
}

export interface IcsParseError {
  eventIndex: number;
  message: string;
}

export interface IcsSerializeEvent {
  id?: number;
  uid?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
  startDate: Date | string;
  endDate: Date | string;
  allDay?: boolean | null;
  checkWeather?: boolean | null;
  projectId?: number | null;
  isRecurring?: boolean | null;
  recurringPattern?: RecurringPattern | null;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

const PRODID = "-//Agri-Cal//Farm Friend//EN";
const FOLD_LIMIT = 74; // 75 octets minus the leading space of continuation lines

function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Offset (ms) of timeZone at the given instant.
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(instant);
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second")
  );
  return asUtc - instant.getTime();
}

// Converts local wall-clock components in a time zone to a UTC instant,
// handling DST by re-checking the offset at the provisional instant.
function zonedTimeToUtc(
  year: number, monthIndex: number, day: number,
  hour: number, minute: number, second: number,
  timeZone: string
): Date {
  const asUtc = Date.UTC(year, monthIndex, day, hour, minute, second);
  const offset1 = timeZoneOffsetMs(new Date(asUtc), timeZone);
  const offset2 = timeZoneOffsetMs(new Date(asUtc - offset1), timeZone);
  return new Date(asUtc - offset2);
}

export function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function unescapeIcsText(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === "n" || next === "N") { out += "\n"; i++; continue; }
      if (next === "," || next === ";" || next === "\\") { out += next; i++; continue; }
    }
    out += ch;
  }
  return out;
}

function foldLine(line: string): string[] {
  if (line.length <= FOLD_LIMIT + 1) return [line];
  const parts: string[] = [line.slice(0, FOLD_LIMIT + 1)];
  let rest = line.slice(FOLD_LIMIT + 1);
  while (rest.length > FOLD_LIMIT) {
    parts.push(" " + rest.slice(0, FOLD_LIMIT));
    rest = rest.slice(FOLD_LIMIT);
  }
  if (rest.length > 0) parts.push(" " + rest);
  return parts;
}

export function formatIcsUtcDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function parseDigits(value: string): { y: number; m: number; d: number; h: number; min: number; s: number } | null {
  if (!/^\d{8}(T\d{6})?$/.test(value)) return null;
  const y = parseInt(value.slice(0, 4), 10);
  const m = parseInt(value.slice(4, 6), 10) - 1;
  const d = parseInt(value.slice(6, 8), 10);
  const hasTime = value.length > 8;
  const h = hasTime ? parseInt(value.slice(9, 11), 10) : 0;
  const min = hasTime ? parseInt(value.slice(11, 13), 10) : 0;
  const s = hasTime ? parseInt(value.slice(13, 15), 10) : 0;
  if (m < 0 || m > 11 || d < 1 || d > 31 || h > 24 || min > 59 || s > 60) return null;
  const probe = new Date(y, m, d);
  if (probe.getMonth() !== m || probe.getDate() !== d) return null;
  return { y, m, d, h, min, s };
}

// Parses a DTSTART/DTEND value. Returns { date, allDay } or an error message.
export function parseIcsDateTime(
  value: string,
  params: Record<string, string>
): { date: Date; allDay: boolean } | { error: string } {
  const raw = value.trim();
  const isDateValue = params.VALUE === "DATE" || params.VALUE === "date";

  if (isDateValue) {
    if (params.TZID) return { error: "VALUE=DATE must not be combined with TZID" };
    const parts = parseDigits(raw);
    if (!parts || raw.length !== 8) return { error: `Unsupported VALUE=DATE form "${raw}"` };
    return { date: new Date(parts.y, parts.m, parts.d, 0, 0, 0, 0), allDay: true };
  }

  if (raw.endsWith("Z")) {
    const parts = parseDigits(raw.slice(0, -1));
    if (!parts || raw.length !== 16) return { error: `Unsupported UTC date-time form "${raw}"` };
    return { date: new Date(Date.UTC(parts.y, parts.m, parts.d, parts.h, parts.min, parts.s)), allDay: false };
  }

  if (params.TZID) {
    const tzid = params.TZID;
    if (!isSupportedTimeZone(tzid)) return { error: `Unsupported or unknown TZID "${tzid}"` };
    const parts = parseDigits(raw);
    if (!parts || raw.length !== 15) return { error: `Unsupported TZID date-time form "${raw}"` };
    return {
      date: zonedTimeToUtc(parts.y, parts.m, parts.d, parts.h, parts.min, parts.s, tzid),
      allDay: false,
    };
  }

  const parts = parseDigits(raw);
  if (!parts || raw.length !== 15) return { error: `Unsupported DTSTART/DTEND form "${raw}"` };
  // Floating local time: interpreted in the local time zone of the importer.
  return { date: new Date(parts.y, parts.m, parts.d, parts.h, parts.min, parts.s), allDay: false };
}

function parseProperty(line: string): IcsProperty | null {
  // NAME;PARAM=VAL;PARAM=VAL:value — the colon after the name/params
  let inQuotes = false;
  let colonIdx = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) { colonIdx = i; break; }
  }
  if (colonIdx === -1) return null;
  const head = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);
  const segments = head.split(";");
  const name = (segments.shift() || "").toUpperCase().trim();
  if (!name) return null;
  const params: Record<string, string> = {};
  for (const segment of segments) {
    const eq = segment.indexOf("=");
    if (eq === -1) continue;
    params[segment.slice(0, eq).toUpperCase().trim()] = segment.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name, params, value };
}

const SUPPORTED_RRULE_FREQ: Record<string, RecurringPattern["frequency"]> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

function parseRRule(value: string): RecurringPattern | { error: string } {
  const parts = value.split(";").map(p => p.trim()).filter(Boolean);
  let frequency: RecurringPattern["frequency"] | null = null;
  let interval = 1;
  let until: string | null = null;
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) return { error: `Malformed RRULE part "${part}"` };
    const key = part.slice(0, eq).toUpperCase();
    const val = part.slice(eq + 1);
    switch (key) {
      case "FREQ":
        frequency = SUPPORTED_RRULE_FREQ[val.toUpperCase()];
        if (!frequency) return { error: `Unsupported RRULE frequency "${val}"` };
        break;
      case "INTERVAL": {
        const n = parseInt(val, 10);
        if (!Number.isFinite(n) || n < 1) return { error: `Invalid RRULE INTERVAL "${val}"` };
        interval = n;
        break;
      }
      case "UNTIL": {
        const parsed = parseIcsDateTime(val, {});
        if ("error" in parsed) return { error: `Invalid RRULE UNTIL "${val}"` };
        until = parsed.date.toISOString();
        break;
      }
      default:
        return { error: `Unsupported RRULE part "${key}"` };
    }
  }
  if (!frequency) return { error: "RRULE is missing FREQ" };
  return { frequency, interval, endDate: until };
}

function unfold(content: string): string[] {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

export function parseICS(content: string): { events: ParsedIcsEvent[]; errors: IcsParseError[] } {
  const lines = unfold(content);
  const events: ParsedIcsEvent[] = [];
  const errors: IcsParseError[] = [];

  let currentIndex = -1;
  let inEvent = false;
  let inSubBlock = false;
  let current: {
    uid: string | null;
    summary: string;
    description: string | null;
    location: string | null;
    dtstart: { date: Date; allDay: boolean } | null;
    dtend: { date: Date; allDay: boolean } | null;
    rrule: RecurringPattern | null;
    checkWeather: boolean;
    unsupported: string[];
    failed: boolean;
  } | null = null;

  const finishEvent = () => {
    if (!current || currentIndex === -1) return;
    const idx = currentIndex;
    if (current.failed) return; // an error was already recorded for this event
    if (!current.dtstart) {
      errors.push({ eventIndex: idx, message: current.unsupported[0] || "Event has no DTSTART" });
      return;
    }
    if (current.unsupported.length > 0) {
      errors.push({ eventIndex: idx, message: current.unsupported.join("; ") });
      return;
    }

    let startDate = current.dtstart.date;
    let endDate: Date;
    if (current.dtend) {
      if (current.dtstart.allDay && !current.dtend.allDay) {
        errors.push({ eventIndex: idx, message: "All-day DTSTART cannot be paired with a timed DTEND" });
        return;
      }
      if (current.dtend.date.getTime() <= startDate.getTime()) {
        errors.push({ eventIndex: idx, message: "DTEND is not after DTSTART" });
        return;
      }
      // RFC 5545: for VALUE=DATE, DTEND is exclusive; store the last covered instant.
      endDate = current.dtend.allDay
        ? new Date(current.dtend.date.getTime() - 1)
        : current.dtend.date;
    } else {
      endDate = current.dtstart.allDay
        ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 23, 59, 59, 999)
        : new Date(startDate.getTime() + 60 * 60 * 1000);
    }

    events.push({
      uid: current.uid,
      title: current.summary || "Imported Event",
      description: current.description,
      location: current.location,
      startDate,
      endDate,
      allDay: current.dtstart.allDay,
      checkWeather: current.checkWeather,
      isRecurring: !!current.rrule,
      recurringPattern: current.rrule,
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      currentIndex = events.length + errors.length;
      current = {
        uid: null, summary: "", description: null, location: null,
        dtstart: null, dtend: null, rrule: null,
        checkWeather: false, unsupported: [], failed: false,
      };
      continue;
    }
    if (line === "END:VEVENT") {
      finishEvent();
      inEvent = false;
      current = null;
      currentIndex = -1;
      continue;
    }
    if (!inEvent) continue;
    if (line.startsWith("BEGIN:")) { inSubBlock = true; continue; }
    if (line.startsWith("END:")) { inSubBlock = false; continue; }
    if (inSubBlock) continue; // VALARM and similar sub-blocks are not event data

    const prop = parseProperty(line);
    if (!prop) continue;

    switch (prop.name) {
      case "UID":
        if (current) current.uid = prop.value.trim();
        break;
      case "SUMMARY":
        if (current) current.summary = unescapeIcsText(prop.value);
        break;
      case "DESCRIPTION":
        if (current) current.description = unescapeIcsText(prop.value);
        break;
      case "LOCATION":
        if (current) current.location = unescapeIcsText(prop.value);
        break;
      case "DTSTART": {
        const parsed = parseIcsDateTime(prop.value, prop.params);
        if ("error" in parsed) {
          errors.push({ eventIndex: currentIndex, message: `DTSTART: ${parsed.error}` });
          if (current) current.failed = true;
        } else if (current) {
          current.dtstart = parsed;
        }
        break;
      }
      case "DTEND": {
        const parsed = parseIcsDateTime(prop.value, prop.params);
        if ("error" in parsed) {
          errors.push({ eventIndex: currentIndex, message: `DTEND: ${parsed.error}` });
          if (current) current.failed = true;
        } else if (current) {
          current.dtend = parsed;
        }
        break;
      }
      case "RRULE": {
        const parsed = parseRRule(prop.value);
        if ("error" in parsed) {
          errors.push({ eventIndex: currentIndex, message: `RRULE: ${parsed.error}` });
          if (current) current.failed = true;
        } else if (current) {
          current.rrule = parsed;
        }
        break;
      }
      case "X-AGRICAL-CHECKWEATHER":
        if (current) current.checkWeather = prop.value.trim().toUpperCase() === "TRUE";
        break;
      case "EXDATE":
      case "RDATE":
      case "RECURRENCE-ID":
        if (current) current.unsupported.push(`Unsupported recurrence property ${prop.name} cannot be imported without losing data`);
        break;
      default:
        break; // Standard properties we do not model (STATUS, CLASS, ...) and X- properties are ignored
    }
  }

  return { events, errors };
}

function toIcsRule(pattern: RecurringPattern): string | null {
  const freq = { day: "DAILY", week: "WEEKLY", month: "MONTHLY", year: "YEARLY" }[pattern.frequency];
  if (!freq) return null;
  const parts = [`FREQ=${freq}`];
  if (pattern.interval && pattern.interval > 1) parts.push(`INTERVAL=${pattern.interval}`);
  if (pattern.endDate) parts.push(`UNTIL=${formatIcsUtcDate(new Date(pattern.endDate))}`);
  return parts.join(";");
}

export function serializeICS(events: IcsSerializeEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:${PRODID}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const now = formatIcsUtcDate(new Date());

  for (const event of events) {
    const startDate = new Date(event.startDate);
    const endDate = new Date(event.endDate);
    const allDay = !!event.allDay;
    const uid = event.uid || `${event.id}@agrical.local`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${now}`);

    if (allDay) {
      const fmt = (d: Date) =>
        `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
      lines.push(`DTSTART;VALUE=DATE:${fmt(startDate)}`);
      // DTEND is exclusive for VALUE=DATE: expose the day after the stored end.
      const exclusiveEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() + 1);
      lines.push(`DTEND;VALUE=DATE:${fmt(exclusiveEnd)}`);
    } else {
      lines.push(`DTSTART:${formatIcsUtcDate(startDate)}`);
      lines.push(`DTEND:${formatIcsUtcDate(endDate)}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(event.title)}`);
    if (event.description) lines.push(...foldLine(`DESCRIPTION:${escapeIcsText(event.description)}`));
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    if (event.isRecurring && event.recurringPattern) {
      const rule = toIcsRule(event.recurringPattern);
      if (rule) lines.push(`RRULE:${rule}`);
    }
    if (event.checkWeather) lines.push("X-AGRICAL-CHECKWEATHER:TRUE");
    if (event.projectId) lines.push(`X-AGRICAL-PROJECTID:${event.projectId}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).flat().join("\r\n");
}

// Duplicate policy for repeat imports: events whose UID already exists for the
// user are skipped (never silently duplicated, never clobbered). Callers
// receive both lists so the decision is explicit in the response.
export function planImport<T extends { uid: string | null }>(
  parsed: ParsedIcsEvent[],
  existingUids: Iterable<string>
): { toCreate: ParsedIcsEvent[]; duplicates: ParsedIcsEvent[] } {
  const seen = new Set(existingUids);
  const toCreate: ParsedIcsEvent[] = [];
  const duplicates: ParsedIcsEvent[] = [];
  for (const event of parsed) {
    if (event.uid && seen.has(event.uid)) {
      duplicates.push(event);
      continue;
    }
    if (event.uid) seen.add(event.uid);
    toCreate.push(event);
  }
  return { toCreate, duplicates };
}
