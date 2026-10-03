import assert from "node:assert/strict";
import { test } from "node:test";
import { getHelmetOptions } from "../server/securityHeaders";

test("production Helmet options enable a restrictive client CSP", () => {
  const options = getHelmetOptions("production");
  const directives = options.contentSecurityPolicy && options.contentSecurityPolicy.directives;

  assert.ok(directives);
  assert.deepEqual(directives.defaultSrc, ["'self'"]);
  assert.deepEqual(directives.scriptSrc, ["'self'"]);
  assert.deepEqual(directives.connectSrc, ["'self'"]);
  assert.deepEqual(directives.fontSrc, ["'self'", "https://fonts.gstatic.com", "data:"]);
  assert.deepEqual(directives.styleSrc, ["'self'", "https://fonts.googleapis.com", "'unsafe-inline'"]);
  assert.deepEqual(directives.frameAncestors, ["'none'"]);
  assert.deepEqual(directives.objectSrc, ["'none'"]);
  assert.ok(!Object.values(directives).some(sources => sources.includes("*")));
});

test("development Helmet options leave Vite HMR CSP disabled", () => {
  assert.equal(getHelmetOptions("development").contentSecurityPolicy, false);
});
