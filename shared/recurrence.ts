// Recurrence expansion engine shared by the calendar display and the
// assistant context builder so both use the same occurrence rules.
//
// Semantics (explicit):
// - Occurrences advance from the series start in fixed steps and are never
//   accumulated from the previous occurrence, so a clamped month-end date
//   (e.g. Jan 31 -> Feb 28) cannot drift the series (Mar 31 stays Mar 31).
// - Month-end and leap-day behavior: a date that does not exist in the target
//   month is clamped to the last day of that month (Jan 31 monthly -> Feb 28/29).
// - Local wall time is preserved across daylight-saving transitions because
//   occurrences are constructed from calendar components (Y/M/D + time), not
//   by adding multiples of 24h in milliseconds.
// - An occurrence belongs to a requested range when [start, start+duration)
//   overlaps the range, so multi-day events starting before the range are
//   still reported for the days they cover.
// - The pattern endDate is inclusive of its entire local calendar day: users
//   pick a date, so "repeat until Jun 3" keeps the occurrence on Jun 3.
// - Expansion work is bounded: the first candidate at or before the range is
//   computed by arithmetic skip-ahead, so an old daily series does not iterate
//   once per elapsed day and no occurrences are silently lost.

export interface RecurringPattern {
  frequency: "day" | "week" | "month" | "year";
  interval: number;
  endDate: string | Date | null;
}

export interface RecurrenceSource {
  startDate: Date | string;
  endDate: Date | string;
  isRecurring?: boolean | null;
  recurringPattern?: unknown;
}

export type ExpandedEvent<T extends RecurrenceSource> = T & {
  instanceDate: Date;
  isRecurrenceInstance: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
// Hard cap on occurrences produced per event per expansion; the skip-ahead
// arithmetic means this only guards against pathological data, not elapsed time.
const MAX_OCCURRENCES = 2000;

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

// Adds whole days preserving the local wall clock (DST-safe).
function addDaysLocal(date: Date, days: number): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + days,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

// Adds whole months, clamping the day-of-month to the target month's last day
// (Jan 31 + 1 month = Feb 28/29; Feb 29 + 1 year = Feb 28) and preserving the
// local wall clock.
function addMonthsLocal(date: Date, months: number): Date {
  const totalMonths = date.getFullYear() * 12 + date.getMonth() + months;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths - year * 12;
  const day = Math.min(date.getDate(), daysInMonth(year, monthIndex));
  return new Date(
    year,
    monthIndex,
    day,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
}

// Whole local days between two local midnights (DST transitions round to the
// nearest whole day rather than drifting).
function localDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfLocalDay(to).getTime() - startOfLocalDay(from).getTime()) / MS_PER_DAY);
}

function wholeMonthsBetween(from: Date, to: Date): number {
  return to.getFullYear() * 12 + to.getMonth() - (from.getFullYear() * 12 + from.getMonth());
}

function overlapsRange(occurrenceStart: Date, occurrenceEnd: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return occurrenceStart.getTime() <= rangeEnd.getTime() && occurrenceEnd.getTime() >= rangeStart.getTime();
}

function expandEvent<T extends RecurrenceSource>(
  event: T,
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent<T>[] {
  const instances: ExpandedEvent<T>[] = [];
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  const duration = Math.max(0, end.getTime() - start.getTime());

  if (overlapsRange(start, new Date(start.getTime() + duration), rangeStart, rangeEnd)) {
    instances.push({ ...event, instanceDate: start, isRecurrenceInstance: false });
  }

  if (!event.isRecurring || !event.recurringPattern) {
    return instances;
  }

  const pattern = event.recurringPattern as RecurringPattern;
  const interval = Number(pattern.interval);
  if (!pattern.frequency || !Number.isFinite(interval) || interval < 1) {
    return instances;
  }

  const seriesEnd = pattern.endDate ? new Date(pattern.endDate) : null;

  // Skip ahead arithmetically so elapsed iterations never have to be walked.
  let step = 0;
  switch (pattern.frequency) {
    case "day": {
      const days = localDaysBetween(start, rangeStart);
      step = Math.max(0, Math.floor(days / interval));
      break;
    }
    case "week": {
      const days = localDaysBetween(start, rangeStart);
      step = Math.max(0, Math.floor(days / (interval * 7)));
      break;
    }
    case "month": {
      const months = wholeMonthsBetween(start, rangeStart);
      step = Math.max(0, Math.floor(months / interval));
      break;
    }
    case "year": {
      step = Math.max(0, rangeStart.getFullYear() - start.getFullYear() >= 0
        ? Math.floor((rangeStart.getFullYear() - start.getFullYear()) / interval)
        : 0);
      break;
    }
  }

  let produced = instances.length;
  let guard = 0;
  // Advance until the occurrence starts beyond the range; each step is derived
  // from the series start so clamps never compound.
  while (guard < MAX_OCCURRENCES) {
    guard++;

    let cursor: Date;
    if (step === 0) {
      cursor = start;
    } else if (pattern.frequency === "day") {
      cursor = addDaysLocal(start, step * interval);
    } else if (pattern.frequency === "week") {
      cursor = addDaysLocal(start, step * interval * 7);
    } else if (pattern.frequency === "month") {
      cursor = addMonthsLocal(start, step * interval);
    } else {
      cursor = addMonthsLocal(start, step * interval * 12);
    }

    if (cursor.getTime() > rangeEnd.getTime()) break;
    if (seriesEnd && startOfLocalDay(cursor) > startOfLocalDay(seriesEnd)) break;

    // step === 0 is the series start itself, already emitted above.
    const occurrenceEnd = new Date(cursor.getTime() + duration);
    if (step > 0 && overlapsRange(cursor, occurrenceEnd, rangeStart, rangeEnd)) {
      instances.push({
        ...event,
        startDate: cursor,
        endDate: occurrenceEnd,
        instanceDate: cursor,
        isRecurrenceInstance: step > 0,
      });
      produced++;
      if (produced >= MAX_OCCURRENCES) break;
    }

    step++;
  }

  return instances;
}

export function expandRecurringEvents<T extends RecurrenceSource>(
  events: T[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEvent<T>[] {
  const expanded: ExpandedEvent<T>[] = [];
  for (const event of events) {
    expanded.push(...expandEvent(event, rangeStart, rangeEnd));
  }
  expanded.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  return expanded;
}
