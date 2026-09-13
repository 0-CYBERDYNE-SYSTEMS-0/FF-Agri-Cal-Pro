// Weather-watch rules: pure evaluation of scheduled events against a
// forecast, producing proposal drafts for the proactive agent. No I/O here —
// the scheduler feeds events + forecast and persists what comes out.

export interface WatchEvent {
  id: number;
  title: string;
  description: string | null;
  startDate: Date;
  endDate: Date;
  checkWeather: boolean | null;
}

export interface WatchForecastDay {
  date: string; // yyyy-mm-dd, farm-local
  precipitation: number; // inches
  precipitationProbability?: number; // 0-100
  tempMin: number; // °F
  tempMax: number; // °F
  windMax: number; // mph
  description: string;
}

export interface ProposalDraft {
  eventId: number | null;
  type: "weather_risk" | "conflict" | "info";
  title: string;
  rationale: string;
  evidence: Record<string, unknown>;
  changeset: Array<{
    eventId: number;
    updates: {
      startDate: string; // ISO
      endDate: string; // ISO
    };
  }>;
}

// Thresholds (US units, matching the app's weather wire format)
const PRECIP_INCHES_TRIGGER = 0.2;
const PRECIP_PROBABILITY_TRIGGER = 60;
const PRECIP_SUITABLE_INCHES = 0.1;
const PRECIP_PROBABILITY_SUITABLE = 40;
const FROST_TEMP_F = 32;
const WIND_SPRAY_MPH = 25;

const SPRAY_PATTERN = /spray|pesticide|herbicide|fungicide|insecticide|foliar/i;

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function moveByDays(date: Date, days: number): Date {
  const moved = new Date(date.getTime());
  moved.setDate(moved.getDate() + days);
  return moved;
}

interface RiskAssessment {
  kind: "rain" | "frost" | "wind";
  reason: string;
  evidence: Record<string, unknown>;
  isSuitable: (day: WatchForecastDay) => boolean;
}

function assessRisk(event: WatchEvent, day: WatchForecastDay): RiskAssessment | null {
  const title = `${event.title} ${event.description ?? ""}`;

  if (day.precipitation >= PRECIP_INCHES_TRIGGER || (day.precipitationProbability ?? 0) >= PRECIP_PROBABILITY_TRIGGER) {
    return {
      kind: "rain",
      reason: `forecast shows ${day.precipitation}" of rain${day.precipitationProbability !== undefined ? ` with ${day.precipitationProbability}% probability` : ""} (${day.description}) on the scheduled day`,
      evidence: { forecastDate: day.date, precipitationInches: day.precipitation, precipitationProbability: day.precipitationProbability ?? null, description: day.description },
      isSuitable: candidate =>
        candidate.precipitation < PRECIP_SUITABLE_INCHES &&
        (candidate.precipitationProbability ?? 0) < PRECIP_PROBABILITY_SUITABLE &&
        candidate.tempMin > FROST_TEMP_F,
    };
  }

  if (day.tempMin <= FROST_TEMP_F) {
    return {
      kind: "frost",
      reason: `frost risk: overnight low of ${day.tempMin}°F forecast on the scheduled day`,
      evidence: { forecastDate: day.date, tempMinF: day.tempMin, description: day.description },
      isSuitable: candidate => candidate.tempMin > FROST_TEMP_F && candidate.precipitation < PRECIP_SUITABLE_INCHES,
    };
  }

  if (day.windMax >= WIND_SPRAY_MPH && SPRAY_PATTERN.test(title)) {
    return {
      kind: "wind",
      reason: `winds up to ${day.windMax} mph forecast — unsafe for spraying on the scheduled day`,
      evidence: { forecastDate: day.date, windMaxMph: day.windMax, description: day.description },
      isSuitable: candidate => candidate.windMax < WIND_SPRAY_MPH && candidate.precipitation < PRECIP_SUITABLE_INCHES,
    };
  }

  return null;
}

/**
 * Evaluate weather-flagged events against forecast days. For each at-risk
 * event, find the first later forecast day that is suitable and draft a
 * proposal that moves the event there (same time of day, same duration).
 * Events with no suitable alternative day yield no proposal — the scheduler
 * may surface them as info-only notifications instead.
 */
export function evaluateWeatherWatch(
  events: WatchEvent[],
  forecast: WatchForecastDay[],
  now: Date = new Date()
): ProposalDraft[] {
  const byDate = new Map(forecast.map(day => [day.date, day]));
  const drafts: ProposalDraft[] = [];

  for (const event of events) {
    if (!event.checkWeather) continue;
    if (event.startDate.getTime() <= now.getTime()) continue; // only future work is movable

    const key = dayKey(event.startDate);
    const day = byDate.get(key);
    if (!day) continue; // outside the forecast horizon

    const risk = assessRisk(event, day);
    if (!risk) continue;

    // First suitable day strictly after the scheduled day, within horizon
    const orderedDates = forecast.map(d => d.date).sort();
    const laterDates = orderedDates.filter(date => date > key);
    let target: WatchForecastDay | null = null;
    for (const date of laterDates) {
      const candidate = byDate.get(date)!;
      if (risk.isSuitable(candidate)) {
        target = candidate;
        break;
      }
    }
    if (!target) continue;

    const dayDelta = daysBetween(key, target.date);
    const newStart = moveByDays(event.startDate, dayDelta);
    const newEnd = moveByDays(event.endDate, dayDelta);

    drafts.push({
      eventId: event.id,
      type: "weather_risk",
      title: `Move "${event.title}" — ${risk.kind} risk on ${key}`,
      rationale:
        `Scheduled for ${key} but the ${risk.reason}. ${target.date} looks workable ` +
        `(${target.description}, ${target.precipitation}" precip, low ${target.tempMin}°F). ` +
        `Proposed change keeps the same time of day and duration.`,
      evidence: {
        risk: risk.kind,
        scheduledDay: risk.evidence,
        proposedDay: { date: target.date, description: target.description, precipitationInches: target.precipitation, tempMinF: target.tempMin, windMaxMph: target.windMax },
      },
      changeset: [
        {
          eventId: event.id,
          updates: { startDate: newStart.toISOString(), endDate: newEnd.toISOString() },
        },
      ],
    });
  }

  return drafts;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export interface ConflictInput {
  id: number;
  title: string;
  startDate: Date;
  endDate: Date;
  location: string | null;
  allDay: boolean | null;
}

const OVERLAP_MIN_MINUTES = 30;

/**
 * Detect schedule conflicts: two non-all-day events at the same location
 * overlapping by at least 30 minutes. Returns info drafts (no changeset) —
 * conflicts need a human decision, not an automatic move.
 */
export function detectLocationConflicts(events: ConflictInput[]): ProposalDraft[] {
  const drafts: ProposalDraft[] = [];
  const movable = events.filter(event => !event.allDay && event.location);

  for (let i = 0; i < movable.length; i++) {
    for (let j = i + 1; j < movable.length; j++) {
      const a = movable[i];
      const b = movable[j];
      if (a.location!.toLowerCase() !== b.location!.toLowerCase()) continue;

      const overlapMs = Math.min(a.endDate.getTime(), b.endDate.getTime()) - Math.max(a.startDate.getTime(), b.startDate.getTime());
      if (overlapMs < OVERLAP_MIN_MINUTES * 60 * 1000) continue;

      drafts.push({
        eventId: a.id,
        type: "conflict",
        title: `Schedule conflict at ${a.location}`,
        rationale:
          `"${a.title}" and "${b.title}" overlap by ${Math.round(overlapMs / 60000)} minutes at ${a.location} ` +
          `on ${dayKey(a.startDate)}. Decide which moves (or whether both can share the space).`,
        evidence: {
          events: [
            { id: a.id, title: a.title, start: a.startDate.toISOString(), end: a.endDate.toISOString() },
            { id: b.id, title: b.title, start: b.startDate.toISOString(), end: b.endDate.toISOString() },
          ],
          location: a.location,
          overlapMinutes: Math.round(overlapMs / 60000),
        },
        changeset: [],
      });
    }
  }

  return drafts;
}
