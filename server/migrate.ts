import path from "path";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { migrate as neonMigrate } from "drizzle-orm/neon-serverless/migrator";
import postgres from "postgres";
import { drizzle as pgDrizzle } from "drizzle-orm/postgres-js";
import { migrate as pgMigrate } from "drizzle-orm/postgres-js/migrator";
import ws from "ws";

const migrationsFolder = path.join(process.cwd(), "migrations");

function buildDatabaseUrl(): string {
  if (process.env.PGHOST) {
    return `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`;
  }
  return process.env.DATABASE_URL!;
}

/**
 * Runs pending Drizzle migrations against the active database at server
 * startup.  Migration SQL files use IF NOT EXISTS / DO…EXCEPTION blocks so
 * they are safe to run against databases that were bootstrapped before the
 * migration system existed — any objects that already exist are skipped
 * rather than causing an error.
 *
 * A short-lived connection is created specifically for migration so the
 * migrator can manage its own transactions independently of the main pool.
 *
 * Developer workflow: after changing shared/schema.ts, run
 *   npx drizzle-kit generate
 * and commit the new .sql file in migrations/.  The next server start will
 * apply it automatically.
 */
export async function runMigrations(): Promise<void> {
  const databaseUrl = buildDatabaseUrl();
  const hostname = new URL(databaseUrl).hostname;
  const isNeon = hostname.endsWith("neon.tech");
  const isLocal =
    hostname === "localhost" ||
    hostname === "helium" ||
    hostname === "127.0.0.1";

  console.log("[migrate] Applying pending database migrations…");

  try {
    if (isNeon) {
      neonConfig.webSocketConstructor = ws;
      const pool = new Pool({ connectionString: databaseUrl });
      const migDb = neonDrizzle({ client: pool });
      await neonMigrate(migDb, { migrationsFolder });
      await pool.end();
    } else {
      const sslOption = isLocal ? false : ("require" as const);
      const client = postgres(databaseUrl, {
        ssl: sslOption,
        prepare: false,
        max: 1,
      });
      const migDb = pgDrizzle(client);
      await pgMigrate(migDb, { migrationsFolder });
      await client.end();
    }

    console.log("[migrate] Database schema is up to date.");
  } catch (err) {
    console.error(
      "[migrate] Migration failed — server cannot start safely:",
      err
    );
    process.exit(1);
  }
}
