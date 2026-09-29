# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read `INTENT.md` first: it is the product contract (agent-driven calendar,
event notes as field guides, farmer approval for consequential actions).
`SPEC.md` is a historical record. `TODOS.md` lists shipped work and open gaps.

## Development Commands

### Essential Commands
- `npm run dev` - Start full development server (both client and backend)
- `npm run server` - Start only the backend server (port configuration in server/index.ts)
- `npm run client:dev` - Start only the client development server on port 5001
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking across entire codebase
- `npm test` - Run the regression suite (node:test, tests/*.test.ts)
- `npx tsx --test tests/plans.test.ts` - Run a single test file
- `npm run db:push` - Push database schema changes using Drizzle

### Database Management
- Database uses PostgreSQL with Drizzle ORM
- Schema defined in `shared/schema.ts`
- Requires `DATABASE_URL` environment variable
- Use `npm run db:push` to apply schema changes
- `migrations/` also holds drizzle-kit generated SQL (`0000`, `0001`) plus
  snapshots; keep it in sync when changing `shared/schema.ts`

## Architecture Overview

### Full-Stack Structure
This is a monorepo with client-server architecture:
- **Root**: Main package.json, shared TypeScript config, database config
- **Client**: React/Vite frontend application (port 5001)
- **Server**: Express.js backend with API routes
- **Shared**: Common schemas and types used by both client and server

### Client Architecture (`client/src/`)
- **React 18** with **TypeScript** and **Vite** build system
- **Wouter** for client-side routing (not React Router)
- **TanStack Query** for API state management
- **Tailwind CSS** with **shadcn/ui** component system
- **React Context** for global state (Calendar, Location, Auth)

### Key Client Patterns
- Path aliases: `@/*` → `client/src/*`, `@shared/*` → `shared/*`
- Component structure: `components/ui/` (primitives), `components/[feature]/` (features)
- State management: React Context + TanStack Query for server state
- API calls: Centralized in `lib/` directory using `queryClient.ts`

### Server Architecture (`server/`)
- **Express.js** backend with TypeScript
- **Drizzle ORM** with PostgreSQL database
- **OpenAI API** integration for AI assistant features
- **Open-Meteo** integration for weather data (no API key required)

### Core Features & Data Flow

#### Calendar System
- Calendar events stored in PostgreSQL via Drizzle ORM
- Events can be linked to projects and include weather data
- AI assistant can create/modify events through typed tool calls (`server/toolSchemas.ts`)
- Multiple view types: day, week, month, year

#### AI Assistant Integration
- Uses OpenAI API for chat functionality
- Can manipulate calendar events and provide recommendations
- Integration with weather and location data for contextual responses
- Chat interface in `components/assistant/ChatInterface.tsx`

#### Plans & Proactive Agent
- `server/planGenerator.ts`: researches a goal and drafts a dependency-linked
  plan via a `submit_plan` tool validated against `shared/plans.ts`; it never
  writes events — dates resolve only when a plan is applied
- `server/scheduler.ts` + `server/weatherWatch.ts`: periodic watch comparing
  scheduled events to the forecast; `weatherWatch` is pure rule evaluation,
  `scheduler` does I/O and persists `proposals` + `notifications`. The
  calendar is never changed without the farmer approving a proposal
- `server/farmContext.ts`: renders farm memory tables into compact context
  lines for the assistant prompt

#### Event Notes Standard
- `server/notesStandard.ts` holds the one notes standard (see `INTENT.md`);
  the chat system prompt (`server/routes.ts`) and the plan prompt
  (`server/planGenerator.ts`) both embed it — edit it there, not in a prompt

#### Security Boundaries
- Calendar, farm, file, and research content goes to the model as user-role
  data, never in the system message; client-supplied history roles are
  rejected
- Consequential tool calls and private file reads create expiring, one-time
  approvals (`assistant_action_approvals` table); the farmer approves
  them in `components/assistant/AssistantActionApprovals.tsx`
- Cookie-authenticated API mutations reject cross-origin requests
- `server/sessionConfig.ts`: production refuses to start without a
  `SESSION_SECRET` of at least 32 bytes; sessions rotate on login
- `SECURITY_PENTEST_REPORT.md` records findings, including ones still open

#### Model & Research Config
- `server/modelConfig.ts`: one model for all chat requests (`CHAT_MODEL` env
  override), capped tool-loop iterations, deliberately no model fallback
- `server/perplexityApi.ts`: web research; `searchWeb` throws on any failure
  (never returns an error string as a result). Env: `PERPLEXITY_API_KEY`,
  optional `PERPLEXITY_MODEL`, `PERPLEXITY_MAX_TOKENS`, `PERPLEXITY_RECENCY`

#### Weather Integration
- Real Open-Meteo API integration (not mocked data; no API key required)
- Location-based weather forecasting
- Agriculture-specific recommendations
- Caching layer for API efficiency (10-minute cache, `server/openWeatherApi.ts`)
- Weather data influences calendar event suggestions

#### Location Services
- Browser geolocation API integration
- Location context affects weather and AI recommendations
- Location settings component for user preferences

### Database Schema
Key tables (from `shared/schema.ts`):
- `users` - User authentication and profiles
- `projects` - Project management with status tracking
- `events` - Calendar events with project/weather linking
- `conversations` - AI chat history storage
- `assistant_action_approvals` - pending one-time approvals for assistant actions
- Farm memory: `farms`, `fields`, `crops`, `equipment`, `buildings`, `staff`
- Planning & agent: `plans`, `proposals`, `notifications`, `weather_cache`
- `session` is created and owned at runtime by connect-pg-simple and is
  excluded from drizzle-kit push (`tablesFilter` in `drizzle.config.ts`)

### API Integration Patterns
- All external APIs are proxied through the backend server
- Client-side caching for weather data
- Error handling with proper TypeScript types
- No direct API key exposure in client code

### Development Workflow
- Start with `npm run dev` for full-stack development
- Use `npm run check` before committing to catch TypeScript errors
- Database changes require running `npm run db:push`
- Environment variables: Create `.env` file in root for API keys

### Testing Approach
- Regression suite via the built-in `node:test` runner: `npm test`
- Tests live in `tests/*.test.ts` and run through tsx (no separate framework)
- Storage, API, plans, research, recurrence, ICS, weather, and tool schemas
  are covered; add a test alongside behavioral changes
- Tests set `process.env.MEM_STORAGE = "1"` *before* dynamically importing
  `server/storage` to use in-memory storage (no database needed); API tests
  mount `registerRoutes` on a bare express app

### Theme System
- Custom theme configuration in `theme.json` files
- Tailwind CSS with custom color schemes
- shadcn/ui theming integration
- Supports both light/dark modes

### Important Implementation Notes
- Weather API requires valid location data - no automatic fallbacks
- AI assistant can create calendar events with weather context
- All API keys should be server-side only
- Agriculture-focused features for farming/outdoor activities