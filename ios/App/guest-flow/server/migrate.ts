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
    `ALTER TABLE printers ADD COLUMN IF NOT EXISTS ip_address text`,
    `ALTER TABLE printers ADD COLUMN IF NOT EXISTS port integer`,
    // Print jobs queue table
    `CREATE TABLE IF NOT EXISTS print_jobs (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      printer_id varchar NOT NULL REFERENCES printers(id) ON DELETE CASCADE,
      label_text text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      attempts integer NOT NULL DEFAULT 0,
      last_error text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(status)`,
  ];
  for (const sql of patches) {
    await pool.query(sql);
  }
  console.log("[migrate] Schema patches applied.");
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
