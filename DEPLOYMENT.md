# Deployment and initialization

## 1. Environment

Set a PostgreSQL connection string before running the database commands:

```bash
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.ivzmjfzhjbijqkarkqrj.supabase.co:5432/postgres"
```

> For Supabase, replace `[YOUR-PASSWORD]` with the database password from the project dashboard and use this full PostgreSQL URL instead of the `https://...` project URL.

## 2. Apply the database schema

```bash
pnpm db:migrate
```

## 3. Seed the initial configuration

```bash
pnpm db:seed
```

The seed command is idempotent and populates the default generation configurations, liturgical functions, function assignments, app settings, and default mass schedules.

## 4. Start the services

```bash
pnpm --filter @workspace/api-server dev
pnpm --filter @workspace/liturgia-flow dev
```

The application no longer relies on visiting a route to bootstrap initial data. A fresh database is ready once migrations and the explicit seed step have completed.
