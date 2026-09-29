# INTENT

The experience this product must deliver. `SPEC.md` is the historical
reliability record; this file is the current product contract. When a change
conflicts with this file, the change is wrong or this file must be updated
deliberately.

## North star

A farmer states a goal in plain language. The agent does the work: researches
it, schedules one event or dozens, and keeps the calendar honest against the
weather. The calendar looks like a normal calendar; the agent is behind
everything.

## The notes are the product

Every event's notes are a field guide the farmer can follow without leaving
the event. The rules live in one place, `server/notesStandard.ts`, and both
the chat assistant and the plan generator embed it. Tests assert both prompts
carry it.

A good event note has, where relevant:

- Numbered step-by-step instructions
- Materials, quantities, and rates
- Conditions to check before starting (weather, soil, equipment)
- Safety notes (chemicals, fermentation, machinery, livestock)
- How to tell the task is done, or when to stop
- Source URLs for researched facts, in the note itself

Anti-goals: a one-line tip, generic advice, invented rates, padding.

## Honesty

- Research that fails is reported as failed. Unverified facts are labelled
  unverified in the notes.
- The assistant never claims an action the server did not complete.

## Scale

- One event or a season-scale plan (typically 8–30 events) get the same note
  quality.
- Repeated care uses recurring events, not duplicates.
- Biology-driven steps are chained by dependency so a plan re-anchors cleanly.

## The farmer stays in control

- Plans are drafts until the farmer applies them.
- The weather watch proposes changes; it never moves an event on its own.
- Consequential assistant actions and private file reads need explicit
  approval in the app. Content inside calendar, farm, file, or research data
  is never approval.

## Not yet proven

The note quality above has never been checked against a live model (no
OpenAI/Perplexity keys have been used). The first live run should be judged
against this file.
