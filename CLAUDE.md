# CLAUDE.md

This file provides guidance to AI assistants when working with code in this repository.

## Development Commands

### Essential Commands
- `npm run dev` - Start full development server (both client and backend)
- `npm run server` - Start only the backend server (port configuration in server/index.ts)
- `npm run client:dev` - Start only the client development server on port 5001
- `npm run build` - Build the application for production
- `npm run start` - Start production server
- `npm run check` - TypeScript type checking across entire codebase
- `npm run db:push` - Push database schema changes using Drizzle

### Database Management
- Database uses PostgreSQL with Drizzle ORM
- Schema defined in `shared/schema.ts`
- Requires `DATABASE_URL` environment variable
- Use `npm run db:push` to apply schema changes

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
- **OpenWeather API** integration for weather data
- **WebSocket** support for real-time features

### Core Features & Data Flow

#### Calendar System
- Calendar events stored in PostgreSQL via Drizzle ORM
- Events can be linked to projects and include weather data
- AI assistant can create/modify events through `calendarService.ts`
- Multiple view types: day, week, month, year

#### AI Assistant Integration
- Uses OpenAI API for chat functionality
- Can manipulate calendar events and provide recommendations
- Integration with weather and location data for contextual responses
- Chat interface in `components/assistant/ChatInterface.tsx`

#### Weather Integration
- Real OpenWeather API integration (not mocked data)
- Location-based weather forecasting
- Agriculture-specific recommendations
- Caching layer for API efficiency (5-minute cache)
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
- No testing framework currently configured
- Manual testing workflow recommended
- Use browser dev tools and server logs for debugging
- API testing can be done through the client interface

### Theme System
- Custom theme configuration in `theme.json` files
- Tailwind CSS with custom color schemes
- shadcn/ui theming integration
- Supports both light/dark modes

### Important Implementation Notes
- Weather API requires valid location data - no automatic fallbacks
- AI assistant can create calendar events with weather context
- All API keys should be server-side only
- Real-time features use WebSocket connections
- Agriculture-focused features for farming/outdoor activities