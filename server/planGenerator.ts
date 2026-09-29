// Plan draft generation: research a goal and compose a structured,
// dependency-linked event plan WITHOUT writing any events. The caller
// (routes) stores the draft; concrete dates are resolved only at apply time.
//
// The model gets read-only tools (web research, weather) and MUST submit its
// plan through the submit_plan tool, whose arguments are validated against
// planPayloadSchema from shared/plans.ts. Writes never happen here.
import { planPayloadSchema, type PlanPayload } from "@shared/plans";
import { CHAT_MODEL, TOOL_LOOP_LIMIT, createChatClient } from "./modelConfig";
import { searchWeb } from "./perplexityApi";
import { EVENT_NOTES_STANDARD } from "./notesStandard";
import { fetchComprehensiveWeather, formatWeatherData } from "./openWeatherApi";

export interface PlanDraftRequest {
  goal: string;
  startDate: Date;
  timeZone: string;
  location: { name: string; lat: number; lon: number } | null;
  farmContextLines: string[];
}

export interface PlanDraft {
  title: string;
  payload: PlanPayload;
}

export interface PlanGeneratorDeps {
  // Injectable for tests: a chat.completions.create-compatible client
  createMessages?: (messages: unknown[], tools: unknown[]) => Promise<{ toolCalls: Array<{ id: string; name: string; arguments: string }>; content: string | null }>;
  search?: (query: string) => Promise<{ content: string; citations: { url: string; title?: string }[] }>;
  weather?: (lat: number, lon: number) => Promise<string | null>;
}

const SUBMIT_PLAN_TOOL = {
  type: "function" as const,
  function: {
    name: "submit_plan",
    description:
      "Submit the complete event plan. Call this exactly once, after your research, with every event in the plan.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short plan title, e.g. 'Fall Vegetable Garden'" },
        events: {
          type: "array",
          description: "Ordered plan events. Use dependsOnIndex to chain steps that must follow another step.",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: {
                type: "string",
                description: "Markdown SOP: what to do, materials, quantities/rates, timing details, safety notes, and what to check before starting.",
              },
              offsetDays: {
                type: "number",
                description: "Days after the anchor (or after the dependency's day) when this event happens. 0 = same day as its anchor.",
              },
              dependsOnIndex: {
                type: "number",
                description: "Index (0-based) of the event this one follows; omit or null to anchor to the plan start. Must be a LOWER index.",
              },
              durationHours: { type: "number", description: "How long the task takes (default 2)" },
              timeOfDay: { type: "string", description: "Local start time HH:MM, 24h (default 09:00)" },
              location: { type: "string", description: "Where on the farm (optional)" },
              checkWeather: { type: "boolean", description: "True for outdoor work (default true)" },
              recurring: {
                type: "object",
                description: "For repeated care tasks (e.g. weekly scouting) instead of many duplicate events",
                properties: {
                  frequency: { type: "string", enum: ["day", "week", "month", "year"] },
                  interval: { type: "number" },
                  endDate: { type: "string", description: "ISO date when repetition ends (optional)" },
                },
                required: ["frequency", "interval"],
              },
            },
            required: ["title", "offsetDays"],
          },
        },
        sources: {
          type: "array",
          description: "Sources used, from your research citations",
          items: {
            type: "object",
            properties: { title: { type: "string" }, url: { type: "string" } },
            required: ["url"],
          },
        },
        summary: { type: "string", description: "2-6 sentence overview of the approach and key timing decisions" },
      },
      required: ["title", "events"],
    },
  },
};

const SEARCH_TOOL = {
  type: "function" as const,
  function: {
    name: "search_web",
    description:
      "Research the question with web search. Use for variety selection, local timing (frost dates, sowing windows), rates/dosages, and any practice you should verify rather than guess. Multiple targeted searches are better than one broad one.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Specific research query with agricultural terms" },
      },
      required: ["query"],
    },
  },
};

const SYSTEM_PROMPT_TEMPLATE = `You are an agricultural planning expert. A farmer has stated a goal. Research it properly, then produce a complete calendar plan.

FARM CONTEXT:
{farmContext}

PLANNING REQUEST:
Goal: {goal}
Anchor date (day 0 for offsets): {anchorDate}
Farm time zone: {timeZone}
{weatherBlock}
WORKFLOW — follow it in order:
1. RESEARCH FIRST. Before planning, use search_web for the facts that drive timing and rates: variety/breed choices for the goal, the local seasonal window, maturation/gestation periods, spacing and rates, and common failure points. Run several targeted searches. If research is unavailable, say so in the summary and clearly mark unverified timings in the event descriptions — never present guesses as researched facts. Collect source URLs for the plan's sources array.
2. BUILD THE EVENT LIST. Typically 8-30 events for a season-scale goal (bed prep through harvest/follow-through), fewer for a simple process. Chain steps that depend on biology (germination, gestation, fermentation, maturity) with dependsOnIndex + offsetDays so the plan stays correct if the anchor moves. Use recurring events for repeated care (watering, scouting, turning) rather than dozens of duplicates.
3. WRITE REAL SOP NOTES to the event notes standard below.
4. SUBMIT once via submit_plan with every event, sources, and a summary.

Hard rules:
- dependsOnIndex must reference an EARLIER event (lower index).
- offsetDays is measured from the anchor (or the dependency's day), never negative.
- Dates are NOT in the payload — only offsets. The system computes dates.
- Every event title must be a concrete task ("Sow sugar snap peas in beds 3-4"), not a category.

${EVENT_NOTES_STANDARD}`;

function formatAnchorDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

async function defaultCreateMessages(messages: unknown[], tools: unknown[]) {
  const chat = await createChatClient();
  const response = await chat.chat.completions.create({ model: CHAT_MODEL, messages, tools } as never);
  const choice = response.choices[0]?.message;
  const toolCalls = (choice?.tool_calls ?? []).map(call => ({
    id: call.id,
    name: call.function.name,
    arguments: call.function.arguments,
  }));
  return { toolCalls, content: choice?.content ?? null };
}

const defaultWeather = async (lat: number, lon: number): Promise<string | null> => {
  const data = await fetchComprehensiveWeather({ lat, lon });
  if (!data || data.forecasts.length === 0) return null;
  const formatted = formatWeatherData(data);
  return (
    `Weather at the farm (${formatted.location}, fetched ${formatted.fetchedAt}): ` +
    formatted.forecast
      .map(day => `${day.date}: ${day.weatherDescription}, high ${day.temp_max}°F, low ${day.temp_min}°F, precip ${day.precipitation}in`)
      .join("; ")
  );
};

export class PlanGenerationError extends Error {
  constructor(message: string, public readonly partial: PlanPayload | null = null) {
    super(message);
  }
}

export async function draftPlan(
  request: PlanDraftRequest,
  deps: PlanGeneratorDeps = {}
): Promise<PlanDraft> {
  const createMessages = deps.createMessages ?? defaultCreateMessages;
  const search = deps.search ?? searchWeb;
  const weather = deps.weather ?? defaultWeather;

  let weatherBlock = "";
  if (request.location) {
    const weatherText = await weather(request.location.lat, request.location.lon).catch(() => null);
    if (weatherText) {
      weatherBlock = `CURRENT FORECAST: ${weatherText}\n`;
    }
  }

  const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{farmContext}", request.farmContextLines.join("\n") || "(no farm profile configured)")
    .replace("{goal}", request.goal)
    .replace("{anchorDate}", formatAnchorDate(request.startDate, request.timeZone))
    .replace("{timeZone}", request.timeZone)
    .replace("{weatherBlock}", weatherBlock);

  const messages: any[] = [{ role: "system", content: systemPrompt }];
  // Plan requests get a larger budget than chat: research + composition.
  const loopLimit = Math.max(TOOL_LOOP_LIMIT, 12);

  for (let step = 1; step <= loopLimit; step++) {
    const { toolCalls, content } = await createMessages(messages, [SEARCH_TOOL, SUBMIT_PLAN_TOOL]);

    if (toolCalls.length === 0) {
      throw new PlanGenerationError(
        `The model replied without submitting a plan: ${content?.slice(0, 300) ?? "(empty)"}`
      );
    }

    messages.push({
      role: "assistant",
      content: content ?? null,
      tool_calls: toolCalls.map(call => ({
        id: call.id,
        type: "function",
        function: { name: call.name, arguments: call.arguments },
      })),
    });

    let submitted: { title: string; payload: PlanPayload } | null = null;

    for (const call of toolCalls) {
      if (call.name === "submit_plan") {
        let raw: any;
        try {
          raw = JSON.parse(call.arguments || "{}");
        } catch {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: "Arguments were not valid JSON. Resubmit the complete plan." }) });
          continue;
        }
        const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : request.goal.slice(0, 80);
        const parsed = planPayloadSchema.safeParse(raw);
        if (!parsed.success) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Plan validation failed: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}. Fix and resubmit the complete plan.` }),
          });
          continue;
        }
        submitted = { title, payload: parsed.data };
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ ok: true, eventCount: parsed.data.events.length }) });
      } else if (call.name === "search_web") {
        let query = "";
        try {
          query = JSON.parse(call.arguments || "{}").query ?? "";
        } catch {
          // treated as empty query below
        }
        try {
          const result = await search(String(query));
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ content: result.content, citations: result.citations }),
          });
        } catch (error: unknown) {
          // Research failure is fed back honestly: the model must not plan on
          // an error string, and must mark unverified timings instead.
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({ error: error instanceof Error ? error.message : "Web research failed" }),
          });
        }
      } else {
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify({ error: `Unknown tool "${call.name}"` }) });
      }
    }

    if (submitted) {
      return submitted;
    }
  }

  throw new PlanGenerationError(
    `Plan generation reached the ${loopLimit}-step limit without a valid submitted plan. Nothing was saved.`
  );
}
