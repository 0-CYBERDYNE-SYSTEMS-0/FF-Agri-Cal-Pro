import { test } from "node:test";
import assert from "node:assert/strict";
import { draftPlan, PlanGenerationError } from "../server/planGenerator";
import { EVENT_NOTES_STANDARD } from "../server/notesStandard";

const REQUEST = {
  goal: "plant a fall vegetable garden",
  startDate: new Date(2026, 8, 14),
  timeZone: "America/Los_Angeles",
  location: null,
  farmContextLines: ["Farm: Willow Creek, Zone 8b, 12.5 acres"],
};

function toolCall(id: string, name: string, args: unknown) {
  return { id, name, arguments: JSON.stringify(args) };
}

test("draftPlan researches then accepts a valid submitted plan", async () => {
  const searches: string[] = [];
  // Build a scripted two-step client: research first, then submit
  const scripted = async (messages: any[]) => {
    const toolResults = messages.filter(m => m.role === "tool");
    if (toolResults.length === 0) {
      return {
        toolCalls: [toolCall("c1", "search_web", { query: "fall garden zone 8b" })],
        content: null,
      };
    }
    return {
      toolCalls: [
        toolCall("c2", "submit_plan", {
          title: "Fall Vegetable Garden",
          events: [
            { title: "Prep beds", offsetDays: 0, description: "Clear beds", durationHours: 3 },
            { title: "Sow seeds", offsetDays: 3, dependsOnIndex: 0 },
          ],
          sources: [{ url: "https://example.edu/fall-garden" }],
          summary: "Prep then sow.",
        }),
      ],
      content: null,
    };
  };

  const draft = await draftPlan(REQUEST, {
    createMessages: scripted,
    search: async q => {
      searches.push(q);
      return { content: `Best bets for zone 8b: broccoli, peas.`, citations: [{ url: "https://example.edu/fall-garden" }] };
    },
  });

  assert.equal(searches.length, 1);
  assert.equal(draft.title, "Fall Vegetable Garden");
  assert.equal(draft.payload.events.length, 2);
  assert.equal(draft.payload.events[1].dependsOnIndex, 0);
  assert.deepEqual(draft.payload.sources, [{ url: "https://example.edu/fall-garden" }]);
});

test("invalid plans are fed back to the model and fixed on resubmit", async () => {
  let submittedOnce = false;
  const scripted = async (messages: any[]) => {
    const lastTool = [...messages].reverse().find(m => m.role === "tool");
    const sawValidationError = lastTool && typeof lastTool.content === "string" && lastTool.content.includes("validation failed");
    if (!submittedOnce && !sawValidationError) {
      submittedOnce = true;
      return {
        toolCalls: [
          toolCall("c1", "submit_plan", {
            title: "Bad",
            events: [{ title: "Backwards", offsetDays: 2, dependsOnIndex: 5 }], // invalid: forward dependency
          }),
        ],
        content: null,
      };
    }
    return {
      toolCalls: [
        toolCall("c2", "submit_plan", {
          title: "Fixed",
          events: [{ title: "Fine", offsetDays: 1 }],
        }),
      ],
      content: null,
    };
  };

  const draft = await draftPlan(REQUEST, { createMessages: scripted });
  assert.equal(draft.title, "Fixed");
});

test("research failures reach the model honestly and planning continues with unverified marking", async () => {
  const scripted = async (messages: any[]) => {
    const hasToolResult = messages.some(m => m.role === "tool");
    if (!hasToolResult) {
      return { toolCalls: [toolCall("c1", "search_web", { query: "anything" })], content: null };
    }
    return {
      toolCalls: [toolCall("c2", "submit_plan", { title: "T", events: [{ title: "E", offsetDays: 0 }], summary: "unverified timings" })],
      content: null,
    };
  };

  const draft = await draftPlan(REQUEST, {
    createMessages: scripted,
    search: async () => {
      throw new Error("PERPLEXITY_API_KEY is not configured");
    },
  });
  assert.equal(draft.payload.summary, "unverified timings");
});

test("a model that never submits a plan fails loudly with nothing saved", async () => {
  const chatty = async () => ({ toolCalls: [], content: "Here is some advice instead..." });
  await assert.rejects(() => draftPlan(REQUEST, { createMessages: chatty }), PlanGenerationError);
});

test("the loop limit surfaces as an explicit error", async () => {
  let calls = 0;
  const endless = async () => {
    calls++;
    return { toolCalls: [toolCall(`c${calls}`, "search_web", { query: `q${calls}` })], content: null };
  };
  await assert.rejects(
    () => draftPlan(REQUEST, { createMessages: endless, search: async () => ({ content: "x", citations: [] }) }),
    /limit/i
  );
});

test("the plan prompt carries the shared event notes standard", async () => {
  let systemPrompt = "";
  const scripted = async (messages: any[]) => {
    systemPrompt = messages[0].content;
    return {
      toolCalls: [
        toolCall("c1", "submit_plan", {
          title: "One step",
          events: [{ title: "Prep beds", offsetDays: 0 }],
          summary: "Prep.",
        }),
      ],
      content: null,
    };
  };

  await draftPlan(REQUEST, { createMessages: scripted, search: async () => ({ content: "", citations: [] }) });

  assert.ok(systemPrompt.includes(EVENT_NOTES_STANDARD));
});
