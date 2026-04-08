# LiturgiaFlow Pro — Workspace

## Overview

LiturgiaFlow Pro is a full-stack Progressive Web App (PWA) for liturgical reader schedule management.
Parish: **Parroquia Santo Cristo de Esquipulas** · Ministry: **Pastoral de Liturgia**

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Frontend**: React 19, Tailwind CSS v4, Wouter, TanStack React Query, Framer Motion, date-fns, vite-plugin-pwa
- **API framework**: Express 5 (TypeScript)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (must use `zod/v4` imports), drizzle-zod
- **API codegen**: Orval from OpenAPI spec → generates React Query hooks
- **Build**: esbuild

## Structure

```text
├── artifacts/
│   ├── api-server/         # Express API (port from $PORT)
│   └── liturgia-flow/      # React Vite PWA (serves at /)
├── lib/
│   ├── api-spec/           # openapi.yaml + orval.config.ts
│   ├── api-client-react/   # Generated React Query hooks (DO NOT EDIT MANUALLY)
│   └── db/                 # Drizzle schema + migrations
│       └── src/schema/
│           ├── readers.ts
│           ├── unavailability.ts
│           ├── calendar.ts
│           └── schedules.ts  ← mass_schedules table + ROLES_BY_DAY_TYPE
```

## Key Commands

```bash
pnpm --filter @workspace/api-spec run codegen   # Regenerate API client from OpenAPI spec
pnpm --filter @workspace/db run push            # Apply DB schema changes (dev only)
pnpm --filter @workspace/db run push-force      # Force push schema (drops constraints)
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `readers` | Reader registry (name, whatsapp, level) |
| `unavailability` | Blocked dates per reader |
| `calendar` | Generated assignments (date + role + scheduleId + readerId) |
| `mass_schedules` | Configurable mass times per day type |

## Mass Schedule Day Types & Roles

| Day Type | Days | Roles |
|----------|------|-------|
| `weekday` | Mon, Tue, Wed, Fri | 1ª Lectura, Salmo |
| `thursday` | Thursday | 1ª Lectura, Salmo, Oraciones |
| `saturday_am` | Saturday | Monitor, 1ª Lectura, Salmo, 2ª Lectura, Oraciones |
| `saturday_pm` | Saturday | Monitor, 1ª Lectura, Salmo, 2ª Lectura, Oraciones |
| `sunday_am` | Sunday | Monitor, Bienvenida 1, Bienvenida 2, 1ª Lectura, Salmo, 2ª Lectura, Oraciones |
| `sunday_pm` | Sunday | Monitor, 1ª Lectura, Salmo, 2ª Lectura, Oraciones |

## Assignment Algorithm Rules

1. **Equity**: Readers with fewer total assignments are prioritized first
2. **Same-day uniqueness**: A reader cannot appear twice on the same day across all masses
3. **Proximity rule**: saturday_pm assignment → blocks sunday_am (obligatory rest)
4. **Unavailability**: Blocked dates are respected in all assignments
5. **Conflict validation**: PUT /calendar/:id and POST /calendar/swap both validate unavailability before saving

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/readers | List readers |
| POST | /api/readers | Create reader |
| PUT | /api/readers/:id | Update reader |
| DELETE | /api/readers/:id | Delete reader |
| GET | /api/unavailability | List (optionally filter by readerId) |
| POST | /api/unavailability | Block date |
| DELETE | /api/unavailability/:id | Unblock date |
| GET | /api/schedules | List mass schedule configs |
| PUT | /api/schedules/:id | Update schedule time/name/active |
| GET | /api/calendar | List entries (filter by startDate/endDate) |
| POST | /api/calendar/generate | Generate assignments for a period |
| POST | /api/calendar/swap | Swap two readers between entries |
| PUT | /api/calendar/:id | Reassign + add logistic comment |
| DELETE | /api/calendar/:id | Delete entry |

## Frontend Features

- **Admin Panel** (4 tabs):
  - **Lectores**: Reader CRUD (name, WhatsApp, level)
  - **Calendario**: 3 view modes:
    - *Cuadrícula* (default): 5-column weekly grid (Jueves / Sáb AM / Sáb PM / Dom AM / Dom PM) with role rows matching the reference design
    - *Lista*: Full table view of all entries with filter
    - *Mensual*: Interactive monthly calendar with liturgical season colors + day detail panel
  - **Generar**: Form to generate assignments (15 days or 1 month)
  - **Configuración**: Edit schedule times per mass type, toggle active/inactive
- **Edit Modal** (Reasignar/Intercambiar): Reassign or swap readers, validates unavailability, supports logistic comments
- **Generation Timestamp**: "Generado el: DD/MM/AAAA HH:MM" shown in calendar header
- **WhatsApp Message**: Formatted message with emoji, schedule times, logistic comments, and generation timestamp
- **Reader Portal** (/lector): Select reader → mark unavailable dates (month navigation) → view upcoming assignments with logistic comments
- **PWA**: Installable on mobile, offline caching for API data, theme-color, manifest, cross icons

## Critical Notes

- Always use `zod/v4` NOT `zod` for imports in api-server
- Never use `console.log` in server — use `req.log` or `logger`
- Role strings in DB are stored as: `"${roleName} - ${scheduleName} ${scheduleTime}"`
- Parse with `roleStr.split(" - ")[0]` for role name, rest for schedule info
- After editing openapi.yaml, run codegen before using new endpoints in frontend
- After editing DB schema, run push command before restarting api-server
