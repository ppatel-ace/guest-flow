---
name: drizzle.config.ts vs server/db.ts DB priority mismatch
description: drizzle.config.ts prefers PGHOST (local Replit DB) over DATABASE_URL; server/db.ts does the opposite. db:push hits the wrong DB.
---

## Rule
Never use `npx drizzle-kit push` bare when both PGHOST and DATABASE_URL are set.
`drizzle.config.ts` resolves: `localUrl ?? process.env.DATABASE_URL` — so PGHOST wins.
`server/db.ts` resolves: `process.env.DATABASE_URL ?? localUrl` — so DATABASE_URL (Supabase) wins.

**Why:** The two files have opposite priority order. This caused schema drift: `db:push` applied columns to the Replit-native Postgres while the running app connected to Supabase and still got "column does not exist".

**How to apply:** When you need to push schema to the production Supabase DB, either:
1. Run the script `scripts/add-missing-columns.ts` (uses server/db.ts's SSL logic)
2. Or `env -u PGHOST npx drizzle-kit push` — but beware Supabase pooler cert issues (needs `?sslmode=require` in URL)
3. Or apply raw SQL via `scripts/add-missing-columns.ts` pattern (postgres.js with IPv4 socket + resolveSsl())

The migration runner (`server/migrate.ts`) also prefers DATABASE_URL, so it IS consistent with the app — but if Drizzle has already marked a migration as applied in `__drizzle_migrations`, updating the SQL file won't re-run it; a new migration file is needed.
