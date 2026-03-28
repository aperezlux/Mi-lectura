# Workspace — LiturgiaFlow Pro

## Overview

LiturgiaFlow Pro is a full-stack Progressive Web App (PWA) for liturgical schedule management. Built with React + Vite frontend and Express + PostgreSQL backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React 19, Tailwind CSS v4, Wouter routing, TanStack React Query
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **UI**: Shadcn components, Framer Motion, react-hook-form

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── liturgia-flow/      # React + Vite PWA frontend (serves at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── readers.ts       # Readers table (name, whatsapp, level)
│           ├── unavailability.ts # Blocked dates per reader
│           └── calendar.ts      # Calendar assignments
├── scripts/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Features

- **Admin Panel**: Manage readers (Principiante/Experto), view/edit calendar, generate schedules
- **Smart Assignment Algorithm**: Equity-based (least assigned first), proximity rule (Sat PM blocks Sun AM), availability checking, VACANTE fallback
- **Liturgical Colors**: Automatic season detection (Verde, Morado, Dorado, Blanco)
- **Reader Portal**: Self-service unavailability calendar at /lector
- **WhatsApp Integration**: Generate and send personalized schedule messages
- **Data Validation**: Full input validation on both frontend and backend

## API Routes

All under `/api` prefix:
- `GET /api/readers` — list all readers
- `POST /api/readers` — create reader
- `PUT /api/readers/:id` — update reader
- `DELETE /api/readers/:id` — delete reader
- `GET /api/unavailability?readerId=` — get blocked dates
- `POST /api/unavailability` — block a date
- `DELETE /api/unavailability/:id` — unblock a date
- `GET /api/calendar?startDate=&endDate=` — get calendar
- `POST /api/calendar/generate` — generate schedule
- `PUT /api/calendar/:id` — update entry
- `DELETE /api/calendar/:id` — delete entry

## Database Schema

- `readers`: id, name, whatsapp, level (Principiante|Experto), created_at
- `unavailability`: id, reader_id, blocked_date (unique per reader+date)
- `calendar`: id, date, role, reader_id, logistic_comment, is_vacant, liturgical_season, version_timestamp

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`.
- **Always typecheck from the root**: `pnpm run typecheck`
- Run codegen: `pnpm --filter @workspace/api-spec run codegen`
- Push DB schema: `pnpm --filter @workspace/db run push`
