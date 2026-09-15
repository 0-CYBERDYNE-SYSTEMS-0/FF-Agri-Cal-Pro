// The proactive agent (Pillar 3): a periodic watch that joins scheduled
// events against the forecast and the calendar, drafts pre-made change
// proposals, and notifies the farmer. Nothing here ever changes the
// calendar by itself — the farmer approves or declines each proposal.
import { storage } from "./storage";
import { expandRecurringEvents, type ExpandedEvent } from "@shared/recurrence";
import { fetchComprehensiveWeather, formatWeatherData, type WeatherResponse } from "./openWeatherApi";
import { evaluateWeatherWatch, detectLocationConflicts, type ProposalDraft, type WatchEvent, type WatchForecastDay, type ConflictInput } from "./weatherWatch";
import type { Event } from "@shared/schema";

const WATCH_INTERVAL_MS = parseInterval(process.env.AGENT_WATCH_INTERVAL_MINUTES, 6 * 60); // default every 6h
const INITIAL_DELAY_MS = 45 * 1000;

function parseInterval(value: string | undefined, fallbackMinutes: number): number {
  const parsed = Number.parseInt(value || "", 10);
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMinutes;
  return minutes * 60 * 1000;
}

export interface WatchRunOptions {
  // Limit the run to one user (used by tests and manual triggers)
  userId?: number;
  // Injectable forecast fetch so tests never touch the network
  fetchForecast?: (location: string | { lat: number; lon: number }) => Promise<WeatherResponse | null>;
  now?: Date;
}

export interface WatchRunResult {
  usersChecked: number;
  proposalsCreated: number;
  notificationsCreated: number;
  skipped: { userId: number; reason: string }[];
}

function toForecastDays(weather: WeatherResponse): WatchForecastDay[] {
  return weather.forecast.map(day => ({
    date: day.date,
    precipitation: day.precipitation,
    precipitationProbability: day.precipitationProbability,
    tempMin: day.temp_min,
    tempMax: day.temp_max,
    windMax: day.wind,
    description: day.weatherDescription,
  }));
}

const defaultFetchForecast = async (location: string | { lat: number; lon: number }): Promise<WeatherResponse | null> => {
  const data = await fetchComprehensiveWeather(location);
  if (!data || data.forecasts.length === 0) return null;
  return formatWeatherData(data);
};

// Users that already have a pending or declined proposal for an event are
// not re-notified: declined means "stop asking", pending means "awaiting an
// answer".
async function eventIdsWithLiveProposals(userId: number): Promise<Set<number>> {
  const proposals = await storage.getProposalsByUser(userId);
  const ids = new Set<number>();
  for (const proposal of proposals) {
    if (proposal.status === "pending" || proposal.status === "declined") {
      if (proposal.eventId !== null) ids.add(proposal.eventId);
      const changeset = Array.isArray(proposal.changeset) ? proposal.changeset : [];
      for (const change of changeset) {
        if (change && typeof change.eventId === "number") ids.add(change.eventId);
      }
    }
  }
  return ids;
}

export async function runWeatherWatch(options: WatchRunOptions = {}): Promise<WatchRunResult> {
  const fetchForecast = options.fetchForecast ?? defaultFetchForecast;
  const now = options.now ?? new Date();
  const result: WatchRunResult = { usersChecked: 0, proposalsCreated: 0, notificationsCreated: 0, skipped: [] };

  // The storage interface has no "list users"; the watch iterates over users
  // that configured a farm profile (the watch only means anything for them).
  const eventsByUser = await allEventsGroupedByUser(options.userId);
  for (const [userId, userEvents] of Array.from(eventsByUser.entries())) {
    try {
      const farm = await storage.getFarmByUser(userId);
      const farmLocation: string | { lat: number; lon: number } | null =
        farm?.latitude != null && farm?.longitude != null
          ? { lat: farm.latitude, lon: farm.longitude }
          : farm?.locationName || null;

      if (!farmLocation) {
        result.skipped.push({ userId, reason: "no farm location configured" });
        continue;
      }

      const weather = await fetchForecast(farmLocation);
      if (!weather || weather.forecast.length === 0) {
        result.skipped.push({ userId, reason: "forecast unavailable" });
        continue;
      }

      const liveProposalIds = await eventIdsWithLiveProposals(userId);

      // Weather watch: only single (non-recurring) future events are movable
      const watchEvents: Event[] = userEvents
        .filter(event => !event.isRecurring)
        .filter(event => new Date(event.startDate).getTime() > now.getTime())
        .filter(event => !liveProposalIds.has(event.id));

      const drafts: ProposalDraft[] = evaluateWeatherWatch(watchEvents, toForecastDays(weather), now);

      // Conflict watch: same-location overlaps across the next 7 days,
      // including recurring occurrences
      const rangeEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const occurrences: ExpandedEvent<Event>[] = expandRecurringEvents<Event>(userEvents, now, rangeEnd);
      const conflictInputs: ConflictInput[] = occurrences
        .filter(event => new Date(event.startDate).getTime() > now.getTime())
        .map(event => ({
          id: event.id,
          title: event.title,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
          location: event.location,
          allDay: event.allDay,
        }));
      const conflictDrafts = detectLocationConflicts(conflictInputs).filter(
        draft => !liveProposalIds.has(draft.eventId!)
      );

      for (const draft of [...drafts, ...conflictDrafts]) {
        const proposal = await storage.createProposal({
          userId,
          eventId: draft.eventId,
          type: draft.type,
          title: draft.title,
          rationale: draft.rationale,
          evidence: draft.evidence,
          changeset: draft.changeset,
        });
        result.proposalsCreated++;
        await storage.createNotification({
          userId,
          proposalId: proposal.id,
          type: "proposal",
          title: draft.title,
          body: draft.rationale,
        });
        result.notificationsCreated++;
      }

      result.usersChecked++;
    } catch (error) {
      // One failing user must not stop the watch
      console.error(`Weather watch failed for user ${userId}:`, error instanceof Error ? error.message : error);
      result.skipped.push({ userId, reason: "error during watch" });
    }
  }

  return result;
}

async function allEventsGroupedByUser(onlyUserId?: number): Promise<Map<number, Event[]>> {
  if (onlyUserId !== undefined) {
    return new Map([[onlyUserId, await storage.getEventsByUser(onlyUserId)]]);
  }
  // Discover active users from farm profiles (the watch only means anything
  // for users who configured a farm).
  const grouped = new Map<number, Event[]>();
  const farmUserIds = await storage.getAllFarmUserIds();
  for (const userId of farmUserIds) {
    grouped.set(userId, await storage.getEventsByUser(userId));
  }
  return grouped;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    runWeatherWatch().then(result => {
      if (result.proposalsCreated > 0) {
        console.log(
          `Weather watch: ${result.proposalsCreated} proposal(s) created across ${result.usersChecked} user(s)`
        );
      }
    }).catch(err => {
      console.error("Weather watch run failed:", err instanceof Error ? err.message : err);
    });
  }, WATCH_INTERVAL_MS);
  // Do not hold the process open just for the watch
  timer.unref?.();

  // First pass shortly after boot so the agent is useful immediately
  const initial = setTimeout(() => {
    runWeatherWatch().catch(err => {
      console.error("Initial weather watch failed:", err instanceof Error ? err.message : err);
    });
  }, INITIAL_DELAY_MS);
  initial.unref?.();

  console.log(`Proactive agent watch started (every ${WATCH_INTERVAL_MS / 60000} minutes)`);
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
