# FF-Agri-Cal-Pro: Audit + Fix + Finalize — COMPLETE ✅

## What We Fixed

### 🔴 Phase 2: Safety
- [x] Created `release/v2` branch — safe from original code
- [x] Stripped 3 Replit-specific dependencies from package.json + vite.config.ts

### 🔴 Phase 3: Auth (Most Impactful)
- [x] **AuthContext.login()** — now calls POST `/api/auth/login` with actual credentials
- [x] **POST `/api/auth/logout`** — new endpoint destroys session + clears cookie
- [x] **GET `/api/auth/status`** — session check endpoint
- [x] **bcrypt hashing** — sample data password now hashed in MemStorage
- [x] **requireAuth middleware** — applied to all GET data routes (projects, events, conversations, files, documents)

### 🟡 Phase 4: Single Source of Truth
- [x] **CalendarContext** — now fetches + exposes events via useQuery (single source)
- [x] **MonthView, WeekView, DayView, YearView** — all use `useCalendar().events` instead of independent queries
- [x] **TanStack Query cache** — shared across all views, auto-dedupes

### 🟢 Phase 5: Missing Features
- [x] **Delete Project button** — with confirmation dialog in Projects page
- [x] **Files page stats** — total files, recent uploads, data files, storage used now populated from API

## Verification
- [x] `npm run check` — 0 TypeScript errors
- [x] `npm run build` — successful (1.3MB JS bundle, 84KB CSS)

## Files Changed (15)
```
client/src/App.tsx                — auto-login error handling
client/src/contexts/AuthContext.tsx  — real login/logout flow
client/src/contexts/CalendarContext.tsx — events as single source
client/src/pages/Projects.tsx     — delete button
client/src/pages/Files.tsx        — API-driven stats
client/src/components/calendar/MonthView.tsx — use CalendarContext
client/src/components/calendar/WeekView.tsx
client/src/components/calendar/DayView.tsx
client/src/components/calendar/YearView.tsx
server/routes.ts                  — logout, auth/status, requireAuth on GETs
server/storage.ts                 — bcrypt hash demo password
vite.config.ts                    — strip Replit plugins
package.json                      — remove Replit deps
.env.example, TODOS.md
```
