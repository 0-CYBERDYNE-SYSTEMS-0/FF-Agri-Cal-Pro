import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";

// The storage module picks its backend singleton at import time; the
// in-memory backend must be selected before any server module loads.
process.env.MEM_STORAGE = "1";
const { default: express } = await import("express");
const { storage } = await import("../server/storage");
const { registerRoutes } = await import("../server/routes");

// Real users created through storage so ownership checks are exercised with
// distinct ids (never relying on the sample-data user).
const testUser = await storage.createUser({
  username: "farmapi1",
  password: "x",
  email: "farmapi1@example.com",
  displayName: "Farm API One",
});
const otherUser = await storage.createUser({
  username: "farmapi2",
  password: "x",
  email: "farmapi2@example.com",
  displayName: "Farm API Two",
});

// Fake session: mutable so individual tests can act as another user or
// unauthenticated. Registered BEFORE registerRoutes so it runs first.
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

test("GET /api/farm returns { farm: null } before configuration", async () => {
  const res = await json("GET", "/api/farm");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { farm: null });
});

test("PUT /api/farm rejects invalid bodies without creating anything", async () => {
  assert.equal((await json("PUT", "/api/farm", {})).status, 400); // name required
  assert.equal((await json("PUT", "/api/farm", { name: "X", userId: 999 })).status, 400); // strict: no userId
  assert.equal((await json("PUT", "/api/farm", { name: "X", latitude: 123 })).status, 400);
  assert.equal((await json("PUT", "/api/farm", { name: "X", longitude: -200 })).status, 400);
  assert.equal((await json("PUT", "/api/farm", { name: "X", totalAcres: -1 })).status, 400);
  assert.equal((await json("PUT", "/api/farm", { name: "X", timeZone: "Not/AZone" })).status, 400);
  assert.equal((await storage.getFarmByUser(testUser.id)), undefined);
});

test("PUT /api/farm creates, then updates the same single row", async () => {
  const first = await json("PUT", "/api/farm", {
    name: "Willow Creek Farm",
    locationName: "Eugene, Oregon",
    latitude: 44.05,
    longitude: -123.09,
    timeZone: "America/Los_Angeles",
    growingZone: "Zone 8b",
    totalAcres: 12.5,
    notes: "Mixed vegetables and orchard",
  });
  assert.equal(first.status, 200);
  assert.ok(first.body.id);
  assert.equal(first.body.name, "Willow Creek Farm");

  const second = await json("PUT", "/api/farm", {
    name: "Willow Creek Farm",
    growingZone: "Zone 8a",
  });
  assert.equal(second.status, 200);
  assert.equal(second.body.id, first.body.id); // same row, not a second farm
  assert.equal(second.body.growingZone, "Zone 8a");
  assert.equal(second.body.totalAcres, 12.5); // untouched fields survive the partial update

  const fetched = await json("GET", "/api/farm");
  assert.equal(fetched.status, 200);
  assert.equal(fetched.body.farm.id, first.body.id);
});

test("farm profile is not leaked across users", async () => {
  sessionUserId = otherUser.id;
  try {
    const res = await json("GET", "/api/farm");
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { farm: null }); // testUser's farm stays private
  } finally {
    sessionUserId = testUser.id;
  }
});

test("fields CRUD round-trip", async () => {
  const created = await json("POST", "/api/fields", {
    name: "North 40",
    acres: 40,
    soilType: "clay loam",
    currentCrop: "winter wheat",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.name, "North 40");
  assert.equal(created.body.status, "active"); // default applied
  const fieldId = created.body.id;

  let list = await json("GET", "/api/fields");
  assert.equal(list.status, 200);
  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].id, fieldId);

  const updated = await json("PUT", `/api/fields/${fieldId}`, { acres: 41, status: "fallow" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.acres, 41);
  assert.equal(updated.body.status, "fallow");
  assert.equal(updated.body.soilType, "clay loam"); // untouched fields preserved

  const removed = await json("DELETE", `/api/fields/${fieldId}`);
  assert.equal(removed.status, 204);
  list = await json("GET", "/api/fields");
  assert.equal(list.body.length, 0);
});

test("unowned field update and delete return 404", async () => {
  const otherField = await storage.createField({
    userId: otherUser.id,
    name: "Other's Field",
    acres: null,
    soilType: null,
    currentCrop: null,
    status: "active",
    notes: null,
  });

  assert.equal((await json("PUT", `/api/fields/${otherField.id}`, { name: "Hijack" })).status, 404);
  assert.equal((await json("DELETE", `/api/fields/${otherField.id}`)).status, 404);
  // The rejected delete left the record untouched
  assert.equal((await storage.getField(otherField.id))!.name, "Other's Field");
});

test("crops accept owned fieldIds and reject foreign ones", async () => {
  const ownField = await storage.createField({
    userId: testUser.id,
    name: "South 10",
    acres: null,
    soilType: null,
    currentCrop: null,
    status: "active",
    notes: null,
  });
  const foreignField = await storage.createField({
    userId: otherUser.id,
    name: "Foreign Field",
    acres: null,
    soilType: null,
    currentCrop: null,
    status: "active",
    notes: null,
  });

  const rejected = await json("POST", "/api/crops", { name: "Sorghum", fieldId: foreignField.id });
  assert.equal(rejected.status, 400);

  const created = await json("POST", "/api/crops", {
    name: "Sorghum",
    variety: "Sugar Drip",
    fieldId: ownField.id,
    plantedAt: "2026-05-01T00:00:00.000Z",
    expectedHarvestAt: "2026-09-10T00:00:00.000Z",
    status: "growing",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.fieldId, ownField.id);
  assert.equal(new Date(created.body.plantedAt).getTime(), new Date("2026-05-01T00:00:00.000Z").getTime());

  // Moving a crop onto a foreign field is rejected the same way
  const moved = await json("PUT", `/api/crops/${created.body.id}`, { fieldId: foreignField.id });
  assert.equal(moved.status, 400);

  const list = await json("GET", "/api/crops");
  assert.equal(list.body.length, 1);
});

test("equipment, buildings, and staff endpoints scope to the session user", async () => {
  assert.equal((await json("POST", "/api/equipment", { name: "John Deere 5100M", category: "tractor" })).status, 201);
  assert.equal((await json("POST", "/api/buildings", { name: "Big Barn", category: "barn" })).status, 201);
  assert.equal((await json("POST", "/api/staff", { name: "Marta", role: "field hand" })).status, 201);

  await storage.createEquipment({ userId: otherUser.id, name: "Foreign Tractor", category: null, status: "operational", notes: null });
  await storage.createBuilding({ userId: otherUser.id, name: "Foreign Barn", category: null, notes: null });
  await storage.createStaffMember({ userId: otherUser.id, name: "Nico", role: null, contact: null, notes: null });

  assert.equal((await json("GET", "/api/equipment")).body.length, 1);
  assert.equal((await json("GET", "/api/buildings")).body.length, 1);
  assert.equal((await json("GET", "/api/staff")).body.length, 1);

  const equipment = (await json("GET", "/api/equipment")).body[0];
  assert.equal((await json("PUT", `/api/equipment/${equipment.id}`, { status: "maintenance" })).body.status, "maintenance");
  assert.equal((await json("DELETE", `/api/equipment/${equipment.id}`)).status, 204);

  const building = (await json("GET", "/api/buildings")).body[0];
  assert.equal((await json("PUT", `/api/buildings/${building.id}`, { notes: "Needs paint" })).body.notes, "Needs paint");
  assert.equal((await json("DELETE", `/api/buildings/${building.id}`)).status, 204);

  const member = (await json("GET", "/api/staff")).body[0];
  assert.equal((await json("PUT", `/api/staff/${member.id}`, { role: "crew lead" })).body.role, "crew lead");
  assert.equal((await json("DELETE", `/api/staff/${member.id}`)).status, 204);
});

test("farm routes require authentication", async () => {
  sessionUserId = null;
  try {
    assert.equal((await json("GET", "/api/farm")).status, 401);
    assert.equal((await json("PUT", "/api/farm", { name: "Nope" })).status, 401);
    assert.equal((await json("POST", "/api/fields", { name: "Nope" })).status, 401);
    assert.equal((await json("GET", "/api/crops")).status, 401);
  } finally {
    sessionUserId = testUser.id;
  }
});
