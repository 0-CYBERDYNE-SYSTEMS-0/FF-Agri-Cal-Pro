import { test, after } from "node:test";
import assert from "node:assert/strict";

process.env.MEM_STORAGE = "1";
const { default: express } = await import("express");
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");

const testUser = await storage.createUser({
  username: "plansapi1",
  password: "x",
  email: "plans1@example.com",
  displayName: "Plans One",
});
const otherUser = await storage.createUser({
  username: "plansapi2",
  password: "x",
  email: "plans2@example.com",
  displayName: "Plans Two",
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

function makeDraftPlan() {
  return storage.createPlan({
    userId: testUser.id,
    projectId: null,
    title: "Tobacco Fermentation Insecticide",
    goal: "create insecticide by fermenting tobacco",
    status: "draft",
    planData: {
      events: [
        {
          title: "Harvest and chop tobacco leaves",
          description: "## Materials\n- 1 kg tobacco leaves\n\n## Steps\n1. Wear gloves",
          offsetDays: 0,
          durationHours: 2,
          timeOfDay: "09:00",
          checkWeather: false,
        },
        {
          title: "Start fermentation batch",
          description: "Steep chopped leaves in 4 L water, cover with cloth",
          offsetDays: 1,
          dependsOnIndex: 0,
          durationHours: 1,
          timeOfDay: "10:00",
          checkWeather: false,
        },
        {
          title: "Scout for aphids weekly",
          description: "Check treated plants weekly",
          offsetDays: 7,
          dependsOnIndex: 1,
          durationHours: 1,
          timeOfDay: "08:00",
          checkWeather: true,
          recurring: { frequency: "week", interval: 1, endDate: "2027-01-01" },
        },
      ],
      sources: [{ url: "https://example.edu/tobacco-fermentation" }],
      summary: "Ferment, strain, spray.",
    },
  });
}

test("apply resolves offsets + dependencies into concrete events", async () => {
  const plan = await makeDraftPlan();

  const applied = await json("POST", `/api/plans/${plan.id}/apply`, {
    startDate: "2026-09-14",
  });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.events.length, 3);

  const [first, second, third] = applied.body.events;
  assert.equal(new Date(first.startDate).getDate(), 14); // offset 0
  assert.equal(new Date(second.startDate).getDate(), 15); // day 1 after dependency
  assert.equal(new Date(third.startDate).getDate(), 22); // +7 after dependency
  assert.ok(!first.isRecurring); // falsy in either backend (null or false)
  assert.equal(third.isRecurring, true);
  assert.equal(third.recurringPattern.frequency, "week");
  assert.equal(applied.body.plan.status, "applied");

  // The events really are in the user's calendar
  const calendar = await json("GET", "/api/events");
  const titles = calendar.body.map((e: any) => e.title);
  assert.ok(titles.includes("Start fermentation batch"));
});

test("a plan cannot be applied twice or after dismissal", async () => {
  const plan = await makeDraftPlan();
  assert.equal((await json("POST", `/api/plans/${plan.id}/apply`)).status, 200);
  assert.equal((await json("POST", `/api/plans/${plan.id}/apply`)).status, 409);

  const draft2 = await makeDraftPlan();
  assert.equal((await json("POST", `/api/plans/${draft2.id}/dismiss`)).status, 200);
  assert.equal((await json("POST", `/api/plans/${draft2.id}/apply`)).status, 409);
});

test("plans are not visible or appliable across users", async () => {
  const plan = await makeDraftPlan();
  sessionUserId = otherUser.id;
  try {
    assert.equal((await json("GET", `/api/plans/${plan.id}`)).status, 404);
    assert.equal((await json("POST", `/api/plans/${plan.id}/apply`)).status, 404);
    const list = await json("GET", "/api/plans");
    assert.equal(list.body.length, 0);
  } finally {
    sessionUserId = testUser.id;
  }
});

test("generation fails honestly without a model key (502, nothing saved)", async () => {
  delete process.env.OPENAI_API_KEY;
  const res = await json("POST", "/api/plans/generate", { goal: "plant a fall garden" });
  assert.equal(res.status, 502);
  const list = await json("GET", "/api/plans");
  const drafts = list.body.filter((p: any) => p.goal === "plant a fall garden");
  assert.equal(drafts.length, 0); // no partial plan persisted
});
