// Web research via the Perplexity API.
//
// Contract: searchWeb THROWS on any failure (missing key, provider outage,
// non-2xx response). Callers must surface the failure — research never
// silently degrades into an error string that looks like a result.
//
// Configuration (all optional):
//   PERPLEXITY_API_KEY     required at call time (throws without it)
//   PERPLEXITY_MODEL       default "sonar"
//   PERPLEXITY_MAX_TOKENS  default 2000
//   PERPLEXITY_RECENCY     optional recency filter (day|week|month|year).
//                          UNSET by default: evergreen agronomy questions
//                          ("how to ferment tobacco insecticide", sowing
//                          depths, maturity days) must not be biased toward
//                          last month's pages. Set only when a query needs
//                          fresh results.

export interface PerplexityCitation {
  url: string;
  title?: string;
}

export interface WebSearchResult {
  content: string;
  citations: PerplexityCitation[];
}

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  citations?: string[];
}

const DEFAULT_MODEL = "sonar";
const DEFAULT_MAX_TOKENS = 2000;

function intEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isResearchConfigured(): boolean {
  return !!process.env.PERPLEXITY_API_KEY;
}

export async function searchWeb(query: string): Promise<WebSearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY is not configured, so web research is unavailable");
  }

  const model = process.env.PERPLEXITY_MODEL || DEFAULT_MODEL;
  const maxTokens = intEnv("PERPLEXITY_MAX_TOKENS", DEFAULT_MAX_TOKENS);

  const body: Record<string, unknown> = {
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant for agricultural planning. Answer precisely and factually. " +
          "Include practical specifics (timing, quantities, temperatures, durations, rates) when the question involves them. " +
          "Prefer extension-service, university, and government sources.",
      },
      { role: "user", content: query },
    ],
    max_tokens: maxTokens,
    temperature: 0.2,
  };
  if (process.env.PERPLEXITY_RECENCY) {
    body.search_recency_filter = process.env.PERPLEXITY_RECENCY;
  }

  let response: Response;
  try {
    response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Web research request failed: ${message}`);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(`Web research failed: Perplexity API error ${response.status} ${errorText.slice(0, 300)}`);
  }

  const data = (await response.json()) as PerplexityResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Web research failed: the provider returned an empty answer");
  }

  const citations: PerplexityCitation[] = (data.citations ?? []).map(url => ({ url }));
  return { content, citations };
}
