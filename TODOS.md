# FF-Agri-Cal-Pro: Status

## Release v2 (branch: release/v2) — work in progress

### Done (earlier phases)
- Branch `release/v2` created, original code safe on `release/v1`
- 3 Replit deps stripped from package.json + vite.config.ts
- Removed 11 Replit artifacts (replit.nix, attached_assets/, repomix.xml)
- .gitignore hardened against future contamination
- AuthContext.login() → POST /api/auth/login (was hitting wrong endpoint)
- POST /api/auth/logout — destroys session + clears cookie
- GET /api/auth/status — session check
- Sample data password bcrypt-hashed
- CalendarContext fetches events via useQuery, shared across all views
- Month/Week/Day/Year views use `useCalendar().events` — no independent queries
- Delete project button w/ confirmation
- Files page stats driven by API

### Done (reliability pass, uncommitted)
- Storage: Drizzle over `pg` (node-postgres) against the existing PostgreSQL
  schema; in-memory storage only via explicit `MEM_STORAGE=1`
- Auth/ownership: no user-1 fallback, no demo auto-login; every private route
  and assistant tool checks the session user and record ownership
- Assistant: bounded tool loop (all tool calls executed, results per call ID),
  single configurable model (no model cascade), partial-result reporting
- Calendar: single range-based event expansion (no fixed ±2-year window,
  no timers/forceRender/remount keys), month-end clamp + DST-safe recurrence,
  multi-day overlap assignment
- ICS: one shared parse/serialize implementation, strict per-event validation,
  transactional import, UID-based duplicate skip on repeat import
- Route order fixed: `/api/events/ics` and `/api/events/weather-dependent`
  registered before `/api/events/:id`
- Session store: connect-pg-simple sharing the pg pool; rate limiter registered
  before API routes; `trust proxy` enabled for secure cookies behind a proxy
- Events table gained a nullable `uid` column (for ICS duplicate detection)
- Focused regression tests via `node:test` (`npm test`)

### Remaining (known gaps)
- End-to-end browser scenario not yet run by the coordinator
- Default chat model (`gpt-4.1-mini`) not verified against a live OpenAI
  account in this environment — set `CHAT_MODEL` if unavailable
- Registration UI exists (Login page toggle); no password reset flow
- Mobile polish for small screens
