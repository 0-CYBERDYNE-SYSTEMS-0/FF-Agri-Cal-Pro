import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { searchWeb, isResearchConfigured } from "../server/perplexityApi";

const realFetch = globalThis.fetch;

function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((url: string | URL, init?: RequestInit) =>
    handler(String(url), init)) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.PERPLEXITY_API_KEY;
  delete process.env.PERPLEXITY_MODEL;
  delete process.env.PERPLEXITY_RECENCY;
  delete process.env.PERPLEXITY_MAX_TOKENS;
});

test("missing API key throws instead of returning an error string", async () => {
  delete process.env.PERPLEXITY_API_KEY;
  assert.equal(isResearchConfigured(), false);
  await assert.rejects(() => searchWeb("sorghum maturity days"), /PERPLEXITY_API_KEY/);
});

test("a successful search returns content and structured citations", async () => {
  process.env.PERPLEXITY_API_KEY = "test-key";
  let seenBody: any;
  stubFetch((url, init) => {
    assert.match(url, /api\.perplexity\.ai/);
    seenBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "Sorghum matures in 90-120 days." } }],
        citations: ["https://example.edu/sorghum", "https://ag.example.gov/maturity"],
      }),
      { status: 200 }
    );
  });

  const result = await searchWeb("sorghum maturity days");

  assert.equal(result.content, "Sorghum matures in 90-120 days.");
  assert.deepEqual(result.citations, [
    { url: "https://example.edu/sorghum" },
    { url: "https://ag.example.gov/maturity" },
  ]);
  // No recency bias by default: evergreen agronomy must not be filtered to
  // the last month, and the request must use the configurable model.
  assert.equal(seenBody.search_recency_filter, undefined);
  assert.equal(seenBody.model, "sonar");
});

test("recency filter is only sent when explicitly configured", async () => {
  process.env.PERPLEXITY_API_KEY = "test-key";
  process.env.PERPLEXITY_RECENCY = "week";
  let seenBody: any;
  stubFetch((_url, init) => {
    seenBody = JSON.parse(String(init?.body));
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "ok" } }], citations: [] }),
      { status: 200 }
    );
  });
  await searchWeb("current seed prices");
  assert.equal(seenBody.search_recency_filter, "week");
});

test("provider errors throw with status information", async () => {
  process.env.PERPLEXITY_API_KEY = "test-key";
  stubFetch(() => new Response("Forbidden", { status: 403 }));
  await assert.rejects(() => searchWeb("anything"), /403/);
});

test("empty provider answers throw instead of returning empty results", async () => {
  process.env.PERPLEXITY_API_KEY = "test-key";
  stubFetch(() => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
  await assert.rejects(() => searchWeb("anything"), /empty/);
});
