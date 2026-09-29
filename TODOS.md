# FF-Agri-Cal-Pro: Status

## Release v2 (branch: release/v2)

### Done — reliability pass (commit `bb6b018`)
- Storage: Drizzle over `pg` against the existing PostgreSQL schema;
  in-memory storage only via explicit `MEM_STORAGE=1`
- Auth/ownership: no user-1 fallback, no demo auto-login; every private route
  and assistant tool checks the session user and record ownership
- Assistant: bounded tool loop (all tool calls executed, results per call ID),
  single configurable model (no model cascade), partial-result reporting
- Calendar: single range-based event expansion, month-end clamp + DST-safe
  recurrence, multi-day overlap assignment
- ICS: one shared parse/serialize implementation, strict per-event validation,
  transactional import, UID-based duplicate skip on repeat import
- Session store: connect-pg-simple sharing the pg pool; rate limiter registered
  before API routes; `trust proxy` enabled for secure cookies behind a proxy
- Events table gained a nullable `uid` column (for ICS duplicate detection)
- Focused regression tests via `node:test` (`npm test`)

### Done — the three pillars (commits `a7eacfb` → `e5866f9`)
Pillar 1 — the program knows the farm:
- Farm profile (one per user, all-optional), fields, crops, equipment,
  buildings, staff: schema, storage (both backends), REST APIs, Farm page
- Farm context injected into every assistant request (compact, truncated)
- Documents page (the API existed; the UI was missing); assistant-written
  plans and notes are now readable
- `read_user_file` returns real stored content (text types, excerpt cap);
  binary formats fail honestly
- Weather snapshots persist daily into `weather_cache`

Pillar 2 — research-grade plans:
- Research fixed: no default recency bias, current Sonar model, 2000-token
  budget, structured citations, failures THROW (never error-strings-as-results)
- Plans: research → draft (relative offsets + dependency chains + markdown
  SOP notes + sources) → preview (server-resolved dates) → apply-all-in-one-
  transaction or dismiss; single-apply guard; Plan Composer UI on the calendar
- Chat `create_plan_draft` tool: the assistant submits reviewable drafts
  instead of writing events directly
- Assistant events support allDay + recurrence; EventModal delete UI,
  locale-safe dates, markdown descriptions with live preview

Pillar 3 — the proactive farm manager:
- Background weather/conflict watch (`server/scheduler.ts`, every 6h by
  default, injectable forecast for tests) joining checkWeather events against
  the 7-day forecast; same-location overlap detection incl. recurring instances
- Proposals: pre-made change sets with rationale + forecast evidence;
  approve applies atomically; declined proposals are never re-raised
- Notification bell: real inbox (unread count, 30s polling, Apply/Dismiss,
  mark read/all); POST /api/agent/run triggers a watch on demand
- The vision scenario is a regression test: rainy-day planting → proposal
  moves it to the next workable day → approval moves the event

### Verified (launch-day re-run, 2026-09-17)
- `npm run check` clean (exit 0)
- `npm test` 70/70 passing, 0 failed (exit 0)
- Production build succeeds (`npm run build`): `dist/index.js` server bundle
  + `dist/public` client assets
- Production smoke test against the built bundle (`NODE_ENV=production node
  dist/index.js`): boots clean (PostgreSQL connected, agent watch started,
  no errors in log); GET / serves the built client; register → login (Secure
  session cookie via simulated TLS-terminating proxy) → `/api/auth/status`
  authenticated → event create (201) → list → delete (204) → logout →
  unauthenticated; unauthenticated `/api/events` rejected 401. Test user,
  events, and sessions cleaned up afterwards
- `npm run db:push` is now a verified no-op: the runtime-owned `session`
  table (connect-pg-simple) is excluded via `tablesFilter` in
  `drizzle.config.ts`; before that fix, push wanted to DROP the live session
  table. All app tables match `shared/schema.ts`
- Earlier E2E smoke against the dev database: register → login → farm upsert
  → field → crop → plan preview → plan apply → double-apply 409 → agent run
  against the live Open-Meteo forecast → notifications endpoints → cleanup

### Remaining (known gaps)
- Live model verification: no OPENAI_API_KEY / PERPLEXITY_API_KEY in this
  environment — set both, and set `CHAT_MODEL` if `gpt-4.1-mini` is
  unavailable on the account. Research and plan generation fail loudly
  (502) until the keys are present.
- Password reset flow (registration UI exists)
- Mobile polish for small screens
- Email/push notification channels (in-app inbox only for now)
- History/yield logging, frost-date & growing-degree intelligence,
  equipment/staff conflict scheduling beyond same-location overlaps

### Handoff checklist (2026-09-28)
- Deploy: `main` includes the security pass (PR #2), which is not yet
  deployed. Apply the schema (`npm run db:push`) before starting the new
  build; it adds `assistant_action_approvals`
- Production env: `DATABASE_URL`, `SESSION_SECRET` (≥32 bytes, enforced),
  `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, optional `CHAT_MODEL`
- First live model run: judge event notes against `INTENT.md`
- Security findings still open (see `SECURITY_PENTEST_REPORT.md`): CSP
  disabled in production, username enumeration at registration, internal
  error details in responses, location values in geocoding logs, no
  provider data retention/redaction controls, four moderate dev-only
  advisories (Drizzle Kit/esbuild)
- `SECURITY_PENTEST_REPORT.md` / `SECURITY_PENTEST_DASHBOARD.html` contain
  reproduction steps; review before widening repo access
