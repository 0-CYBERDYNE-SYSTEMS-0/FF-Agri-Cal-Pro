import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.MEM_STORAGE = "1";
const { default: express } = await import("express");
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");
const { runWeatherWatch } = await import("../server/scheduler");

const testUser = await storage.createUser({
  username: "agent1",
  password: "x",
  email: "agent1@example.com",
  displayName: "Agent One",
});
const otherUser = await storage.createUser({
  username: "agent2",
  password: "x",
  email: "agent2@example.com",
  displayName: "Agent Two",
});

await storage.createFarm({
  userId: testUser.id,
  name: "Willow Creek",
  locationName: "Eugene, Oregon",
  latitude: 44.05,
  longitude: -123.09,
  timeZone: "America/Los_Angeles",
  growingZone: null,
  totalAcres: null,
  notes: null,
});
await storage.createFarm({
  userId: otherUser.id,
  name: "Foreign Farm",
  locationName: "Nowhere",
  latitude: 40,
  longitude: -100,
  timeZone: "UTC",
  growingZone: null,
  totalAcres: null,
  notes: null,
});

let sessionUserId: number | null = testUser.id;
const app = express();
app.use(express.json());
app.use((req: any, _res: any, next: any) => {
  req.session = { userId: sessionUserId };
  next();
});

const server = await registerRoutes(app);
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as Exclude<typeof server.address, string | null>).port;
const base = `http://127.0.0.1:${port}`;

after(() => new Promise<void>(resolve => server.close(() => resolve())));

async function json(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  const res = await fetch(base + path, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

// The vision scenario: planting scheduled in five days, heavy rain forecast
// for that day, clear skies later in the week.
const RAINY_FORECAST = {
  location: "Eugene, Oregon",
  units: { temperature: "°F", wind: "mph", precipitation: "inches", visibility: "kilometers" },
  fetchedAt: new Date().toISOString(),
  current: {
    date: "2026-09-10", dayOfWeek: "Today", temperature: 70, temp_min: 70, temp_max: 70,
    feels_like: 70, weatherDescription: "Clear", icon: "☀️", wind: 5, humidity: 50,
    precipitation: 0, isCurrent: true,
  },
  forecast: [
    { date: "2026-09-11", dayOfWeek: "Fri", temperature: 72, temp_min: 50, temp_max: 75, feels_like: 72, weatherDescription: "Clear", icon: "☀️", wind: 5, humidity: null, precipitation: 0 },
    { date: "2026-09-15", dayOfWeek: "Tue", temperature: 60, temp_min: 45, temp_max: 58, feels_like: 58, weatherDescription: "Heavy rain", icon: "🌧️", wind: 12, humidity: null, precipitation: 0.9, precipitationProbability: 85 },
    { date: "2026-09-16", dayOfWeek: "Wed", temperature: 62, temp_min: 47, temp_max: 60, feels_like: 60, weatherDescription: "Showers", icon: "🌦️", wind: 10, humidity: null, precipitation: 0.4, precipitationProbability: 70 },
    { date: "2026-09-17", dayOfWeek: "Thu", temperature: 70, temp_min: 48, temp_max: 68, feels_like: 68, weatherDescription: "Clear", icon: "☀️", wind: 6, humidity: null, precipitation: 0, precipitationProbability: 10 },
  ],
};

function plantingEvent(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return storage.createEvent({
    userId: testUser.id,
    projectId: null,
    title: "Plant brassica beds",
    description: "Transplant starts",
    startDate: new Date(y, m - 1, d, 9, 0),
    endDate: new Date(y, m - 1, d, 11, 0),
    allDay: false,
    location: "Field 3",
    checkWeather: true,
    isRecurring: false,
    recurringPattern: null,
  });
}

test("the watch drafts a rain proposal with a ready-to-apply changeset", async () => {
  await plantingEvent("2026-09-15"); // the rainy day

  const result = await runWeatherWatch({
    userId: testUser.id,
    fetchForecast: async () => RAINY_FORECAST as any,
    now: new Date(2026, 8, 10, 8, 0),
  });

  assert.equal(result.usersChecked, 1);
  assert.equal(result.proposalsCreated, 1);
  assert.equal(result.notificationsCreated, 1);

  const pending = await json("GET", "/api/proposals?status=pending");
  assert.equal(pending.body.length, 1);
  const proposal = pending.body[0];
  assert.equal(proposal.type, "weather_risk");
  assert.match(proposal.rationale, /rain/);

  // The pre-made change: move to Thursday the 17th, same time and duration
  const change = proposal.changeset[0];
  const newStart = new Date(change.updates.startDate);
  assert.equal(newStart.getDate(), 17);
  assert.equal(newStart.getHours(), 9);

  // A notification points at the proposal
  const inbox = await json("GET", "/api/notifications");
  assert.equal(inbox.body.unreadCount, 1);
  assert.equal(inbox.body.notifications[0].proposalId, proposal.id);
  assert.equal(inbox.body.notifications[0].type, "proposal");
});

test("approving the proposal moves the event and records the decision", async () => {
  const pending = await json("GET", "/api/proposals?status=pending");
  const proposal = pending.body[0];

  const before = await json("GET", `/api/events/${proposal.changeset[0].eventId}`);
  assert.equal(new Date(before.body.startDate).getDate(), 15);

  const approved = await json("POST", `/api/proposals/${proposal.id}/approve`);
  assert.equal(approved.status, 200);
  assert.equal(approved.body.proposal.status, "approved");
  assert.equal(approved.body.appliedEvents.length, 1);
  assert.equal(new Date(approved.body.appliedEvents[0].startDate).getDate(), 17);

  // Re-deciding is a conflict
  assert.equal((await json("POST", `/api/proposals/${proposal.id}/approve`)).status, 409);
  assert.equal((await json("POST", `/api/proposals/${proposal.id}/decline`)).status, 409);

  // An "applied" notification exists and read-all works
  const inbox = await json("GET", "/api/notifications");
  assert.ok(inbox.body.notifications.some((n: any) => n.type === "applied"));
  await json("POST", "/api/notifications/read-all");
  assert.equal((await json("GET", "/api/notifications")).body.unreadCount, 0);
});

test("declined proposals are not re-raised by later watches", async () => {
  await plantingEvent("2026-09-15"); // another rainy-day event

  await runWeatherWatch({ userId: testUser.id, fetchForecast: async () => RAINY_FORECAST as any, now: new Date(2026, 8, 10, 8, 0) });
  const pending = await json("GET", "/api/proposals?status=pending");
  assert.equal(pending.body.length, 1);

  const declined = await json("POST", `/api/proposals/${pending.body[0].id}/decline`);
  assert.equal(declined.status, 200);

  // Run the watch again: no new proposal for the same event
  const result = await runWeatherWatch({ userId: testUser.id, fetchForecast: async () => RAINY_FORECAST as any, now: new Date(2026, 8, 10, 8, 0) });
  assert.equal(result.proposalsCreated, 0);
});

test("users without a farm location are skipped, not crashed", async () => {
  const result = await runWeatherWatch({
    userId: otherUser.id,
    // A farm location exists but the forecast fails
    fetchForecast: async () => null,
    now: new Date(2026, 8, 10, 8, 0),
  });
  assert.equal(result.usersChecked, 0);
  assert.ok(result.skipped.some(s => s.reason === "forecast unavailable"));
});

test("proposals and notifications are user-scoped", async () => {
  sessionUserId = otherUser.id;
  try {
    const proposals = await json("GET", "/api/proposals");
    assert.equal(proposals.body.length, 0);
    const inbox = await json("GET", "/api/notifications");
    assert.equal(inbox.body.notifications.length, 0);
  } finally {
    sessionUserId = testUser.id;
  }
});

test("the watch creates frost and growing-degree proposals without changing the calendar", async () => {
  const crop = await storage.createCrop({
    userId: testUser.id,
    fieldId: null,
    name: "Tomatoes",
    variety: null,
    plantedAt: new Date("2026-09-01T00:00:00Z"),
    expectedHarvestAt: null,
    status: "growing",
    notes: null,
  });
  const event = await plantingEvent("2026-09-15");
  const frostForecast = {
    ...RAINY_FORECAST,
    forecast: [
      { ...RAINY_FORECAST.forecast[0], date: "2026-09-15", temp_min: 30, temp_max: 55, weatherDescription: "Frost" },
      { ...RAINY_FORECAST.forecast[0], date: "2026-09-16", temp_min: 45, temp_max: 65, weatherDescription: "Clear" },
    ],
  };

  const result = await runWeatherWatch({
    userId: testUser.id,
    fetchForecast: async () => frostForecast as any,
    fetchGddWeather: async () => [
      { date: "2026-09-01", tempMin: 50, tempMax: 80 },
      { date: "2026-09-02", tempMin: 55, tempMax: 85 },
    ],
    now: new Date(2026, 8, 10, 8, 0),
  });

  assert.equal(result.proposalsCreated, 2);
  const pending = await json("GET", "/api/proposals?status=pending");
  const frost = pending.body.find((proposal: any) => proposal.type === "weather_risk");
  const gdd = pending.body.find((proposal: any) => proposal.type === "info" && proposal.evidence?.kind === "gdd");
  assert.ok(frost);
  assert.ok(gdd);
  assert.equal(gdd.evidence.cropId, crop.id);
  assert.match(gdd.rationale, /estimate/);

  const before = await json("GET", `/api/events/${event.id}`);
  assert.equal(new Date(before.body.startDate).getDate(), 15);
  await json("POST", `/api/proposals/${frost.id}/approve`);
  const after = await json("GET", `/api/events/${event.id}`);
  assert.equal(new Date(after.body.startDate).getDate(), 16);

  const approvedGdd = await json("POST", `/api/proposals/${gdd.id}/approve`);
  assert.equal(approvedGdd.status, 200);
  assert.deepEqual(approvedGdd.body.appliedEvents, []);
});
