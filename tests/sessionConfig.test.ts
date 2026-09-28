import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveSessionSecret } from "../server/sessionConfig";

test("production session config fails closed without a strong signing secret", () => {
  assert.throws(() => resolveSessionSecret("production", undefined), /SESSION_SECRET/);
  assert.throws(() => resolveSessionSecret("production", "too-short"), /SESSION_SECRET/);
  assert.equal(resolveSessionSecret("production", "x".repeat(32)), "x".repeat(32));
});

test("development session config creates an unpredictable process-local secret", () => {
  const first = resolveSessionSecret("development", undefined);
  const second = resolveSessionSecret("development", undefined);
  assert.ok(Buffer.byteLength(first, "utf8") >= 32);
  assert.notEqual(first, second);
});
