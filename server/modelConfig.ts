// Single model configuration for all assistant requests (initial and every
// follow-up in the tool loop). One model, one place, env-overridable. There is
// deliberately no automatic fallback to other models: if the configured model
// fails, the failure is surfaced explicitly.
//
// NOTE: the default below could not be verified against a live OpenAI account
// in this environment (no API key available). Set CHAT_MODEL to a model your
// account has access to if the default is not available.
const DEFAULT_CHAT_MODEL = "gpt-4.1-mini";

export const CHAT_MODEL = process.env.CHAT_MODEL || DEFAULT_CHAT_MODEL;

// Maximum number of model requests per chat message. The loop stops earlier
// when the model returns a final reply without tool calls.
export const TOOL_LOOP_LIMIT = parsePositiveInt(process.env.TOOL_LOOP_LIMIT, 8);

export async function createChatClient(): Promise<import("openai").default> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured. The assistant requires OPENAI_API_KEY (and CHAT_MODEL if the default is unavailable)."
    );
  }
  const OpenAI = (await import("openai")).default;
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
