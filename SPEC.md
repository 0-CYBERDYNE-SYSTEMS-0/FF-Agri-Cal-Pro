# Calendar reliability specification

Status: historical — the reliability pass (commit bb6b018) implemented this spec, and launch verification on 2026-09-19 confirmed it. Kept as the record of the review.
Superseded for product direction by `INTENT.md`. Its "do not add background scheduling, agents, a workflow framework" constraint applied to that pass only; the proactive agent and plans were added deliberately afterwards.
Review date: 2026-09-08, America/Los_Angeles.
Baseline: `release/v2`, `afafc605c05c7670560a1955ccf5e87d91928e7f`.

## Goal and assumptions

The calendar must show saved tasks correctly. The assistant must use the selected location, time, calendar, and real weather data.
An assistant reply must describe the actual result of a requested operation.

Assumption: this is a calendar for real use. Users expect saved data to survive a server restart.
Assumption: “modes” includes calendar views and location-aware versus general advice. AI model selection is a separate setting.
Keep day, week, month, and year views. Keep manual event entry, projects, weather, and calendar exchange.
Do not add background scheduling, agents, a workflow framework, or a general mode engine.

## Evidence and scope

The upstream branch hash matched this checkout during review. The review read its README, planning files, and implementation.
The README describes PostgreSQL and OpenWeather. The actual runtime selects `MemStorage` and calls Open-Meteo.
No deployed installation was identified or tested. This specification describes the checked branch.
The review artifacts (`analysis-report.html`, `architecture.html`, `spec-awareness.html`) were removed in the post-launch cleanup; recover them from git history if needed.

## 1. Delete unsafe and false behavior first

Delete the reply-scanning effect in `client/src/components/assistant/ChatInterface.tsx:188`.
Delete automatic compost event creation, scheduling-claim recovery, and the related text-to-event confirmation path.
Remove their callers and then delete unused parsing helpers in `client/src/lib/calendarService.ts`.
Keep explicit manual forms. Assistant writes must originate from validated server tool calls.

Delete the `analyze_farm_data` tool registration and dispatcher branch until real file analysis exists.
Its current results are fixed text, independent of file contents (`server/routes.ts:1336`).
Remove matching capability claims from prompts and documentation.

Delete the client context POST to `/api/conversations/:id/system-message`. No matching server route exists.
Remove the duplicate client context formatter and query if no displayed feature consumes them.
Delete `/api/assistant/update-system-message`; it reports success without changing any prompt.

Acceptance:

- Ask about compost without requesting a task. No event is created.
- Reload and reopen a conversation. No event is created from its saved messages.
- A successful tool write creates one event. Its final reply creates no additional event.
- The assistant never presents the fixed farm-analysis statements as measured results.
- The browser sends no request to the missing system-message route.

## 2. Use one context contract and one chat operation

Put the location preference in `LocationContext`. Keep the saved location separate from permission to use it for advice.
Use `adviceMode: "general" | "local"` and one validated location value. Derive availability from that value.
General advice must not trigger automatic location lookup or weather requests.
Local advice without a valid location must return a clear missing-location state. Never substitute New York.

Both chat screens must use the same request function and response handling.
Keep both screen layouts only if they remain useful. Do not maintain separate chat behavior for each layout.
Send `{message, adviceMode, location, timeZone}` in the message body.
Validate this contract on the server. Derive user identity from the authenticated session.
Resolve time zone explicitly. Do not use the server's local clock as the farm's local clock.

Build context once per message on the server. Include:

- Request time, farm time zone, advice mode, and resolved location.
- Weather source, fetch time, units, forecast dates, and unavailable status when relevant.
- Relevant calendar occurrences and event IDs for the requested date range.
- Selected project details when the request concerns a project.

Do not call the first five stored events “upcoming.” Filter and sort by the requested interval.
Use the same recurrence rules for assistant context and calendar display.
Do not label every farm with a northern-hemisphere season. Derive it from location or omit it.
Keep file access demand-driven through validated tools. Do not inject every file into every prompt.

Acceptance:

- Both chat screens send the same location and mode contract.
- General advice works without location or weather access.
- A selected Oregon location never becomes New York in the model request.
- A southern-hemisphere location does not receive an assumed northern season.
- A recurring event appears in context for its next occurrence, with its saved event ID.
- Changing the location changes the next request. Old system messages cannot override the new context.

## 3. Fix the weather boundary

Keep the real Open-Meteo integration and its short cache.
Choose one explicit wire format: `{location, units, fetchedAt, current, forecast}`.
For the existing US display, request Fahrenheit and mph explicitly, or convert once at the server boundary.
Use returned unit metadata to verify the conversion. Keep precipitation units explicit too.
Do not label metric values as imperial values.

Update `useWeather` and `WeatherRow` together. The current route separates `current` from `forecast`.
The current hook reads `forecasts`, which the route does not return.
Accept validated coordinates and named locations through the same route contract.
Do not send `lat` and `lon` to a route that requires `location`.
Handle hourly forecast times in the provider's time zone. Preserve actual forecast dates in assistant context.
Represent unavailable forecast humidity as unavailable, rather than a measured value of 50%.

Acceptance:

- A deterministic provider response of 0°C and 10 km/h displays 32°F and approximately 6.2 mph.
- The weather page, calendar cards, and assistant receive the same current reading and forecast dates.
- A coordinate location and a named location both return valid weather data.
- Provider failure shows unavailable weather. It does not erase calendar context or invent measurements.
- One live request through the application route confirms units, location, and timestamps.

## 4. Complete tool execution and refresh from results

Replace the one-tool branch with a bounded loop. Execute every returned tool call, preserving each call ID.
Add each result to the conversation before the next model request.
Continue until the model returns a final reply or the configured limit is reached.
Return a clear partial result at the limit. Do not report completion for unexecuted calls.

Use one server model configuration for initial and follow-up requests.
Default proposal: one verified model, with explicit failure. Remove the automatic four-model path.
If fallback remains necessary, use one documented policy for all loop steps and report the model actually used.
Do not assume that the currently hard-coded model IDs are available; verify the intended account before choosing the default.

Validate create and update arguments separately. An update accepts supported partial fields and converts dates at the boundary.
Return not-found or failure when a write does not succeed.
Return structured mutation results with saved IDs. Both chat screens invalidate event and project queries from those results.
Keep a stable event query key scoped to the authenticated user. Remove refresh counters from query identity.
Clear private cached data when the authenticated user changes. Enable private queries only after authentication.

Acceptance:

- “Create a project, then add two tasks” executes all required calls and returns three saved IDs.
- Two tool calls in one response both run and receive matching results.
- An update of only a title succeeds without requiring all creation fields.
- A failed write never produces a successful completion result.
- A server-created event appears in every calendar view without reload, from either chat screen.
- An upstream failure after a successful write exposes that write as completed; retry must not silently duplicate it.

## 5. Protect and retain saved data

Remove the implicit user-1 fallback and default demo login from normal operation.
Authenticate every private route. Check ownership before reading, changing, or deleting a saved object.
Apply the same checks to assistant tools and related project IDs.
Reject client attempts to change ownership or internal IDs through update bodies.
Register the API rate limiter before API routes.

Use the existing PostgreSQL schema for persistent storage, with a verified compatible Drizzle driver.
Do not add another database system. Keep memory storage only for explicitly selected tests or demonstrations.
Normal startup must fail clearly when persistent storage is unavailable.
Add a persistent session store for normal deployment and verify secure-cookie behavior at the actual proxy.
Do not run a database migration against an unidentified remote database.

Acceptance:

- Unauthenticated private reads and writes fail with 401.
- User B cannot read, change, or delete User A's events, projects, files, documents, or conversations.
- The same restriction holds through assistant tools and project-filtered list routes.
- Create an event, restart the test server, and read the same event ID and values.
- The limiter blocks repeated requests to an actual registered API endpoint.
- Logout stays logged out and removes the previous user's cached data.

## 6. Keep views; remove render workarounds and duplicate calendar code

Keep `CalendarContext` as the view/date owner. Call `setView` directly.
Delete both timer layers, `forceRender`, remount keys, and `ViewDebugger`.
Use one event query and derive occurrences for the displayed range. Remove the fixed wall-clock ±2-year window.
Advance recurrence from the requested range without losing old daily series after 500 iterations.
Define month-end and leap-day behavior explicitly. Preserve local time across daylight-saving transitions.
Use overlap when assigning multi-day events to visible dates.

Consolidate ICS parsing and serialization. Keep one implementation, shared where necessary.
Preserve UTC markers, time zones, all-day dates, escaping, recurrence, and stable UIDs.
Reject unsupported properties clearly. Do not silently skip standard `DTSTART;VALUE=DATE` or `DTSTART;TZID=...` events.
Validate the full import before writes. Use a transaction for the batch.
Use imported UIDs to prevent silent duplicates on repeat import, or present an explicit duplicate decision.
Fix literal route order: `/api/events/ics` and `/api/events/weather-dependent` currently follow `/api/events/:id`.

Acceptance:

- All four views show the same saved events after create, update, delete, and import.
- A view change does not need timers or remount counters.
- An old daily series appears in the current range after more than 500 elapsed days.
- Test January 31 recurrence, leap day, daylight-saving changes, and multi-day overlap.
- Import/export tests cover UTC, TZID, all-day, folded text, escaped text, and recurrence.
- Invalid import causes no partial write. Repeat import causes no silent duplicate.
- The two literal event routes reach their intended handlers.

## Delete later, only after callers are migrated

Remove unused assistant function endpoints after a reference check and replacement of any remaining consumers.
Remove duplicate ICS functions, deprecated weather wrappers, and unused natural-language parsers after caller migration.
Correct README and TODOS claims about storage, weather provider, real-time updates, and completed verification.
`agri-cal-ui-minimal.zip` was the pre-build UI mockup archive; the UI it specced has shipped. Removed in the post-launch cleanup — recoverable from git history.
Do not remove UI primitives or dependencies without an import and build check.
Keep the existing schema, React Query, useful forms, and calendar layouts. A new application framework is unnecessary.

## Delivery order and release proof

First remove false writes and false analysis. Then fix context, weather, tool execution, and shared refresh behavior.
Complete ownership and persistence before real use. Finish calendar semantics before claiming reliable calendar exchange.
Repair the lockfile in the implementation change, using an agreed Node/npm version.

Run focused regression tests, `npm ci`, `npm run check`, and `npm run build`.
Then run one browser scenario through the real app: login, choose location, ask for a weather-aware task, verify its ID.
Open each view, reload, restart the test server, and confirm the task remains correct.
Exercise general mode, provider failure, and an unauthorized second user in the same test environment.
Use test data and a test database. A mocked provider test proves control flow, not live account access.
Record the exact model, weather source, location, time zone, saved IDs, and results without exposing secrets.
Do not call the pipeline complete until this scenario passes.
