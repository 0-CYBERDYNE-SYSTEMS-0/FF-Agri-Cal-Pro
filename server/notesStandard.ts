// The event-notes standard (see INTENT.md). Event notes are the product: a
// field guide the farmer follows without leaving the event. Both the chat
// assistant and the plan generator embed this one text so they cannot drift.
export const EVENT_NOTES_STANDARD = `EVENT NOTES STANDARD — every event description is Markdown the farmer will follow in the field. Include, where relevant:
- Numbered step-by-step instructions
- Materials, quantities, and rates
- Conditions to check before starting (weather, soil, equipment)
- Safety notes (chemicals, fermentation, machinery, livestock)
- How to tell the task is done, or when to stop
- Source URLs for researched facts, in the notes themselves
Mark anything not verified by research as unverified — never present guesses as researched facts. Two useful sentences beat one vague line; do not pad.`;
