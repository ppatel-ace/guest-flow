import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { migrate as neonMigrate } from "drizzle-orm/neon-serverless/migrator";
import pkg from "pg";
const { Pool: PgPool } = pkg;
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";
import { migrate as pgMigrate } from "drizzle-orm/node-postgres/migrator";
import ws from "ws";

const migrationsFolder = path.join(process.cwd(), "migrations");

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  if (process.env.PGHOST) {
    return `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`;
  }
  throw new Error("DATABASE_URL must be set.");
}

function resolveMigrateSsl(
  databaseUrl: string
): boolean | { rejectUnauthorized: boolean } | undefined {
  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname;
  const sslmode = parsed.searchParams.get("sslmode");
  const isSupabase =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  const isLocal =
    hostname === "localhost" || hostname === "helium" || hostname === "127.0.0.1";

  if (sslmode === "disable") return false;
  if (sslmode === "require") return { rejectUnauthorized: false };
  if (sslmode === "verify-full" || sslmode === "verify-ca") return { rejectUnauthorized: true };
  // No explicit sslmode — use hostname heuristics
  if (isLocal) return false;
  if (isSupabase) return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

// Applies any schema changes that may have been missed by the Drizzle migrator
// (e.g. when a migration file was added to the journal after the DB was already
// marked up-to-date).  Every statement uses IF NOT EXISTS so it is fully idempotent.
async function applySchemaPatches(pool: InstanceType<typeof PgPool>): Promise<void> {
  const patches = [
    // Printer columns added after the initial printers table creation
    `ALTER TABLE gf_printers ADD COLUMN IF NOT EXISTS ip_address text`,
    `ALTER TABLE gf_printers ADD COLUMN IF NOT EXISTS port integer`,
    // Print jobs queue table
    `CREATE TABLE IF NOT EXISTS gf_print_jobs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      printer_id varchar NOT NULL REFERENCES gf_printers(id) ON DELETE CASCADE,
      label_text text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON gf_print_jobs(status)`,
    // ACE POC office locations
    `ALTER TABLE gf_ace_pocs ADD COLUMN IF NOT EXISTS locations text[] NOT NULL DEFAULT '{}'`,
    `UPDATE gf_ace_pocs
     SET locations = ARRAY['New Jersey', 'Maryland', 'Michigan']::text[]
     WHERE locations IS NULL OR cardinality(locations) = 0`,
    // Visitors walk-in table + columns (idempotent). Older migrations created
    // unprefixed "visitors"; the app reads gf_visitors.
    `CREATE TABLE IF NOT EXISTS gf_visitors (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name text NOT NULL,
      email text,
      phone_number text,
      company text,
      ace_poc text,
      signed_in_at timestamp NOT NULL DEFAULT now(),
      signed_out_at timestamptz,
      us_citizen text,
      purpose text,
      location text,
      source text NOT NULL DEFAULT 'kiosk',
      notes text,
      photo_data text,
      documents_agreed text,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS us_citizen text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS purpose text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS signed_out_at timestamptz`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS phone_number text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS photo_data text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS documents_agreed text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS location text`,
    `ALTER TABLE gf_visitors ADD COLUMN IF NOT EXISTS notes text`,
    // Shared Hub email recipient SoT (always-notify + per-office)
    `CREATE TABLE IF NOT EXISTS public.ace_email_recipients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      app_slug TEXT NOT NULL,
      email_type TEXT NOT NULL,
      label TEXT NOT NULL,
      recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_by TEXT,
      updated_source TEXT NOT NULL DEFAULT 'migration',
      UNIQUE (app_slug, email_type)
    )`,
    `CREATE INDEX IF NOT EXISTS ace_email_recipients_app_idx
      ON public.ace_email_recipients (app_slug, email_type)`,
  ];
  for (const sql of patches) {
    await pool.query(sql);
  }
  console.log("[migrate] Schema patches applied.");
}

/** If gf_visitors was recreated empty, copy rows back from legacy unprefixed visitors. */
async function restoreLegacyVisitorsIfEmpty(pool: InstanceType<typeof PgPool>): Promise<void> {
  try {
    const legacy = await pool.query(`SELECT to_regclass('public.visitors') IS NOT NULL AS exists`);
    if (!legacy.rows[0]?.exists) return;
    const counts = await pool.query(`
      SELECT
        (SELECT COUNT(*)::int FROM gf_visitors) AS gf_count,
        (SELECT COUNT(*)::int FROM visitors) AS legacy_count
    `);
    const gfCount = Number(counts.rows[0]?.gf_count ?? 0);
    const legacyCount = Number(counts.rows[0]?.legacy_count ?? 0);
    if (gfCount > 0 || legacyCount === 0) return;

    const inserted = await pool.query(`
      INSERT INTO gf_visitors (
        id, full_name, email, company, ace_poc, signed_in_at, signed_out_at,
        us_citizen, purpose, location, source, notes, photo_data, documents_agreed, created_at
      )
      SELECT
        id, full_name, email, company, ace_poc, signed_in_at, signed_out_at,
        us_citizen, purpose, location, COALESCE(NULLIF(source, ''), 'kiosk'),
        notes, photo_data, documents_agreed, COALESCE(created_at, now())
      FROM visitors
      ON CONFLICT (id) DO NOTHING
    `);
    const phoneCol = await pool.query(`
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'visitors' AND column_name = 'phone_number'
    `);
    if ((phoneCol.rowCount ?? 0) > 0) {
      await pool.query(`
        UPDATE gf_visitors g
        SET phone_number = v.phone_number
        FROM visitors v
        WHERE g.id = v.id
          AND g.phone_number IS NULL
          AND v.phone_number IS NOT NULL
      `);
    }
    console.log(`[migrate] Restored ${inserted.rowCount ?? 0} visitor rows from legacy visitors → gf_visitors.`);
  } catch (err) {
    console.warn("[migrate] Legacy visitor restore skipped:", err);
  }
}

export async function runMigrations(): Promise<void> {
  const databaseUrl = buildDatabaseUrl();
  const hostname = new URL(databaseUrl).hostname;
  const isNeon = hostname.endsWith("neon.tech");
  const isReplit = !!process.env.REPL_ID;

  console.log("[migrate] Applying pending database migrations…");

  try {
    if (isNeon && isReplit) {
      // Replit + Neon: use WebSocket-based Neon serverless driver
      neonConfig.webSocketConstructor = ws;
      const pool = new Pool({ connectionString: databaseUrl });
      const migDb = neonDrizzle({ client: pool });
      await neonMigrate(migDb, { migrationsFolder });
      await pool.end();
    } else {
      // Use standard node-postgres (pg) driver — works with Supabase, local, and Docker.
      // pg parses sslmode from the URL and may override our explicit ssl config,
      // so strip it from the URL and pass ssl settings explicitly instead.
      const ssl = resolveMigrateSsl(databaseUrl);
      const urlForPg = new URL(databaseUrl);
      urlForPg.searchParams.delete("sslmode");
      const pool = new PgPool({ connectionString: urlForPg.toString(), ssl });
      const migDb = pgDrizzle(pool);
      await pgMigrate(migDb, { migrationsFolder });
      // Run idempotent safety patches after migrations so any columns that were
      // missed due to journal desync are always present.
      await applySchemaPatches(pool);
      await restoreLegacyVisitorsIfEmpty(pool);
      await pool.end();
    }

    console.log("[migrate] Database schema is up to date.");
  } catch (err) {
    console.error("[migrate] Migration failed:", err);
    // In development, a migration failure is non-fatal — schema is managed via db:push
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      console.warn("[migrate] Continuing in development mode despite migration failure.");
    }
  }
}
