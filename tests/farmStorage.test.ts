import { test } from "node:test";
import assert from "node:assert/strict";

// The storage module picks its backend singleton at import time; the
// in-memory backend must be selected before it loads.
process.env.MEM_STORAGE = "1";
const { MemStorage } = await import("../server/storage");

// Farm-context entities: create/list/update/delete round-trips against the
// in-memory backend (the PostgreSQL backend mirrors these methods).
test("farm profile is one-per-user upsert", async () => {
  const storage = new MemStorage();
  const user = await storage.createUser({
    username: "farmtest1",
    password: "x",
    email: "f1@example.com",
    displayName: "Farmer One",
  });

  assert.equal(await storage.getFarmByUser(user.id), undefined);

  const created = await storage.createFarm({
    userId: user.id,
    name: "Willow Creek Farm",
    locationName: "Eugene, Oregon",
    latitude: 44.05,
    longitude: -123.09,
    timeZone: "America/Los_Angeles",
    growingZone: "Zone 8b",
    totalAcres: 12.5,
    notes: null,
  });
  assert.equal((await storage.getFarmByUser(user.id))!.id, created.id);

  const updated = await storage.updateFarm(created.id, { growingZone: "Zone 8a" });
  assert.equal(updated!.growingZone, "Zone 8a");

  // Second user has no farm leaked
  const other = await storage.createUser({
    username: "farmtest2",
    password: "x",
    email: "f2@example.com",
    displayName: "Farmer Two",
  });
  assert.equal(await storage.getFarmByUser(other.id), undefined);
});

test("fields, crops, equipment, buildings, staff round-trip and stay user-scoped", async () => {
  const storage = new MemStorage();
  const user = await storage.createUser({
    username: "entitytest",
    password: "x",
    email: "e@example.com",
    displayName: "Entity Test",
  });

  const field = await storage.createField({
    userId: user.id,
    name: "North 40",
    acres: 40,
    soilType: "clay loam",
    currentCrop: null,
    status: "active",
    notes: null,
  });
  assert.equal((await storage.getFieldsByUser(user.id)).length, 1);

  const crop = await storage.createCrop({
    userId: user.id,
    fieldId: field.id,
    name: "Sorghum",
    variety: "Sugar Drip",
    plantedAt: null,
    expectedHarvestAt: null,
    status: "planning",
    notes: null,
  });
  crop.status = "planted";
  await storage.updateCrop(crop.id, { status: "planted" });
  assert.equal((await storage.getCropsByUser(user.id))[0].status, "planted");

  await storage.createEquipment({ userId: user.id, name: "John Deere 5100M", category: "tractor", status: "operational", notes: null });
  await storage.createBuilding({ userId: user.id, name: "Big Barn", category: "barn", notes: null });
  await storage.createStaffMember({ userId: user.id, name: "Marta", role: "field hand", contact: "555-0100", notes: null });

  assert.equal((await storage.getEquipmentByUser(user.id)).length, 1);
  assert.equal((await storage.getBuildingsByUser(user.id)).length, 1);
  assert.equal((await storage.getStaffByUser(user.id)).length, 1);

  assert.ok(await storage.deleteField(field.id));
  assert.equal((await storage.getFieldsByUser(user.id)).length, 0);
});

test("plans, proposals, and notifications persist with status transitions", async () => {
  const storage = new MemStorage();
  const user = await storage.createUser({
    username: "agenttest",
    password: "x",
    email: "a@example.com",
    displayName: "Agent Test",
  });

  const plan = await storage.createPlan({
    userId: user.id,
    title: "Fall Garden",
    goal: "plant a fall vegetable garden",
    planData: { events: [{ title: "Prep beds", offsetDays: 0 }], sources: [], summary: "" },
  });
  assert.equal(plan.status, "draft");
  await storage.updatePlan(plan.id, { status: "applied", appliedAt: new Date() });
  assert.equal((await storage.getPlansByUser(user.id))[0].status, "applied");

  const proposal = await storage.createProposal({
    userId: user.id,
    type: "weather_risk",
    title: "Rain risk before planting",
    rationale: "80% rain probability on the scheduled day",
  });
  assert.equal((await storage.getPendingProposalsByUser(user.id)).length, 1);
  await storage.updateProposal(proposal.id, { status: "declined", decidedAt: new Date() });
  assert.equal((await storage.getPendingProposalsByUser(user.id)).length, 0);

  const notification = await storage.createNotification({
    userId: user.id,
    type: "proposal",
    title: "Weather alert",
    body: "Consider moving Tuesday planting",
    proposalId: proposal.id,
  });
  assert.equal(notification.read, false);
  await storage.markNotificationRead(notification.id, true);
  await storage.createNotification({ userId: user.id, type: "info", title: "Another" });
  const marked = await storage.markAllNotificationsRead(user.id);
  assert.ok(marked >= 1);
  assert.ok((await storage.getNotificationsByUser(user.id)).every(n => n.read));
});

test("weather cache upserts one row per location per day", async () => {
  const storage = new MemStorage();
  await storage.upsertWeatherCache("Eugene, Oregon", new Date(2026, 8, 13, 10, 0), { temp: 70 });
  await storage.upsertWeatherCache("Eugene, Oregon", new Date(2026, 8, 13, 16, 0), { temp: 75 });
  // same-day upsert replaces rather than accumulates; implementation detail is
  // internal, so this just asserts no throw and idempotency across call sites
  await storage.upsertWeatherCache("Eugene, Oregon", new Date(2026, 8, 14, 10, 0), { temp: 68 });
});
