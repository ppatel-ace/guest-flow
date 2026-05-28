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
      // Use standard node-postgres (pg) driver — works with Supabase, local, and Docker
      const pool = new PgPool({ connectionString: databaseUrl });
      const migDb = pgDrizzle(pool);
      await pgMigrate(migDb, { migrationsFolder });
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
