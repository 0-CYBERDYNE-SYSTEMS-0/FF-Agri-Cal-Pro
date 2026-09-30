<p align="center">
  <img src="docs/readme/hero.png" alt="A week on the calendar: mow headlands, soil sampling, scout the north field, an irrigation repair, fertigate, market day." width="100%">
</p>

# FF Agri-Cal

Plan the season. The forecast does the watching.

You put the field work on the calendar. The forecast for your place sits beside it, and the weather page shows which of today's jobs depend on it.

![The weather page for one place: today's reading, what it means for the work, and the job that depends on it](docs/readme/app.png)

## What you can do

- Put field work on a calendar — day, week, month, or year.
- Keep projects beside it: a field, a planting, a block of beds.
- See the forecast for your own place, and what it means for today's work.
- Import a calendar file you already keep (.ics).
- Ask the assistant, and keep the answers with the calendar.

## What it will not do

- It does not switch a valve, start a pump, or move water. It is a calendar, a forecast, and a notebook.
- It does not guess your place. Set the location, or the forecast is not yours.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer and PostgreSQL.

```sh
git clone https://github.com/0-CYBERDYNE-SYSTEMS-0/FF-Agri-Cal-Pro.git
cd FF-Agri-Cal-Pro
npm install
cp .env.example .env     # set DATABASE_URL; set SESSION_SECRET if it is on the internet
npm run db:push
npm run dev
```

The app opens on port 5001 and its server runs on port 3000. The forecast needs no key — it comes from Open-Meteo. The assistant needs `OPENAI_API_KEY`.

To look around without a database, set `MEM_STORAGE=1` in `.env` and skip `db:push`. Nothing is saved.

## License

MIT — see [LICENSE](LICENSE).

## Developer reference

## `> PROJECT_OVERVIEW`
```typescript
interface FFAgriCalPro {
  type: "Full-Stack Agricultural Calendar Application"
  features: ["AI Assistant", "Weather Integration", "Project Management"]
  stack: {
    frontend: ["React 18", "TypeScript", "TanStack Query", "Tailwind CSS", "shadcn/ui"]
    backend: ["Express.js", "PostgreSQL", "Drizzle ORM (node-postgres)", "OpenAI API"]
    deployment: ["Production Optimized"]
  }
}

## `> CORE_FEATURES`
<table>
<tr>
<td width="33%" align="center">

###  Agricultural Focus

 100%
Farm-Ready Features

- Crop planning & tracking
- Weather-aware scheduling
- Seasonal recommendations
- Field management tools

</td>
<td width="33%" align="center">

###  AI Assistant

 100%
OpenAI Integration

- Natural language commands
- Smart event creation
- Agricultural insights
- Contextual recommendations

</td>
<td width="33%" align="center">

###  Weather Intelligence

 Live Provider Data

- Location-based forecasts (Open-Meteo, no API key required)
- Agricultural alerts
- Event weather checking
- 10-minute cache

</td>
</tr>
</table>

## `> QUICK_START`
```bash
# Clone repository
git clone https://github.com/0-CYBERDYNE-SYSTEMS-0/FF-Agri-Cal-Pro.git
cd FF-Agri-Cal-Pro

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Add your configuration:
# - DATABASE_URL (PostgreSQL, required for normal startup)
# - SESSION_SECRET (any long random string; keeps logins stable across restarts)
# - OPENAI_API_KEY
# - CHAT_MODEL (optional override of the single assistant model)
# Database initialization
npm run db:push

# Launch development server
npm run dev


   SYSTEM ONLINE                                               

  Frontend:  http://localhost:5001                               
  Backend:   http://localhost:3000                               
  Database:  PostgreSQL (Drizzle ORM)                           


## `> ARCHITECTURE`

FF-Agri-Cal-Pro/

 client/               # React + TypeScript frontend
    src/
       components/   # UI components (shadcn/ui)
       contexts/     # React Context providers
       lib/          # Utilities & API client
       pages/        # Application routes
   
 server/               # Express.js backend
    routes.ts         # API endpoints
    openWeatherApi.ts # Weather integration
    index.ts          # Server entry point

 shared/               # Shared types & schemas
    schema.ts         # Drizzle ORM schemas

 [CONFIG FILES]        # TypeScript, Vite, Tailwind

## `> TECHNOLOGY_STACK`
<div align="center">

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18 + TypeScript | Modern UI with type safety |
| **Routing** | Wouter | Lightweight client routing |
| **State** | TanStack Query + Context | Efficient data management |
| **Styling** | Tailwind CSS + shadcn/ui | Beautiful, consistent design |
| **Backend** | Express.js + TypeScript | RESTful API server |
| **Database** | PostgreSQL + Drizzle ORM | Relational data storage |
| **AI** | OpenAI API | Intelligent assistance (single configurable model) |
| **Weather** | Open-Meteo | Forecasts (no API key required) |
| **Build** | Vite + ESBuild | Lightning-fast builds |

</div>

## `> API_ENDPOINTS`
```typescript
// Auth (session cookie)
POST   /api/auth/register        // Create account
POST   /api/auth/login           // Authenticate
POST   /api/auth/logout          // Session end
GET    /api/auth/status          // Session check

// Calendar Management (all require authentication; owned records only)
GET    /api/events               // List events (all, by range, or by project)
POST   /api/events               // Create event
GET    /api/events/:id           // Read event
PUT    /api/events/:id           // Update event (partial fields)
DELETE /api/events/:id           // Delete event
GET    /api/events/ics           // Export events as ICS
POST   /api/events/import-ics    // Import ICS (validated, transactional)
GET    /api/events/weather-dependent // Weather-dependent events

// Project Management
GET    /api/projects             // List projects
POST   /api/projects             // Create project
GET    /api/projects/:id         // Read project
PUT    /api/projects/:id         // Update project
DELETE /api/projects/:id         // Delete project

// AI Assistant
POST   /api/conversations/:id/messages // Send a chat message
GET    /api/conversations        // Chat history

// Farm Profile (the app's memory of your operation)
GET    /api/farm                 // Farm profile (null when not configured)
PUT    /api/farm                 // Create-or-update the profile
GET/POST/PUT/DELETE /api/fields      // Fields & growing areas
GET/POST/PUT/DELETE /api/crops       // Crop plantings
GET/POST/PUT/DELETE /api/equipment   // Equipment inventory
GET/POST/PUT/DELETE /api/buildings   // Buildings & infrastructure
GET/POST/PUT/DELETE /api/staff       // Staff & labor

// Plans (researched, approval-gated event batches)
POST   /api/plans/generate       // Research a goal → plan draft (no events written)
GET    /api/plans                // List plans
GET    /api/plans/:id            // Read a plan
GET    /api/plans/:id/preview    // Resolve concrete dates without applying
POST   /api/plans/:id/apply      // Approve: create all events in one transaction
POST   /api/plans/:id/dismiss    // Discard a draft

// Proactive Agent
GET    /api/proposals            // Agent proposals (pre-made change sets)
POST   /api/proposals/:id/approve // Apply the change set
POST   /api/proposals/:id/decline // Decline (never re-raised)
POST   /api/agent/run            // Trigger the watch now
GET    /api/notifications        // Inbox (unread count included)
POST   /api/notifications/:id/read
POST   /api/notifications/read-all

// Weather Services (Open-Meteo)
GET    /api/weather              // Current conditions + 7-day forecast
```

## `> THE THREE PILLARS`
1. **It knows the farm** — farm profile, fields, crops, equipment, buildings, and staff (all optional) are stored and injected into every assistant answer.
2. **It researches and plans** — say "I want to plant a vegetable garden": the assistant researches verified sources, then composes a dependency-linked plan draft (timings, gestation periods, markdown SOP notes per event) that you review and approve before anything touches the calendar.
3. **It manages proactively** — a background watch joins weather-dependent events against the forecast (and detects same-location conflicts), drafts pre-made changes with evidence, and surfaces them via the notification bell for one-click approval.

## `> DATABASE_SCHEMA`
```sql
-- Core Tables
users                 # User authentication & profiles
projects              # Agricultural projects
events                # Calendar events with weather linking
conversations         # AI chat history
weather_cache         # Persisted daily weather snapshots (agent history)

-- Farm memory
farms                 # One farm profile per user (all fields optional)
fields                # Fields & growing areas
crops                 # Crop plantings in the ground or planned
equipment             # Tractors, implements, tools
buildings             # Barns, greenhouses, sheds
staff                 # Crew and labor

-- Planning & the agent
plans                 # Researched plan drafts (applied atomically on approval)
proposals             # Agent change sets awaiting approve/decline
notifications         # Inbox behind the bell

## `> DEVELOPMENT`
```bash
# Development commands
npm run dev              # Full-stack development
npm run server           # Backend only
npm run client:dev       # Frontend only
npm run check            # TypeScript checking
npm run build            # Production build
npm run db:push          # Database migrations

## `> DEPLOYMENT`
```bash
# Production build
npm run build

# Start production server
NODE_ENV=production npm start

## `> ENVIRONMENT_VARIABLES`
```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# External APIs
OPENAI_API_KEY=sk-...

# Assistant model (optional; no automatic fallback)
CHAT_MODEL=gpt-4.1-mini

# Session
SESSION_SECRET=your-secret-key

## `> CONTRIBUTING`
```bash
# Development workflow
git checkout -b feature/your-feature
npm run check                    # Type checking
git commit -m "feat: description"
git push origin feature/your-feature

## `> LICENSE`

MIT License - See LICENSE file for details

---

<div align="center">


   BUILT FOR FARMERS  |  POWERED BY AI  |  DRIVEN BY WEATHER     
                                                                   


</div>