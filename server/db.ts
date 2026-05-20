import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Prefer the local Helium PostgreSQL (PGHOST) if available, since DATABASE_URL
// may point to an external service (Supabase) that could be paused or unavailable.
const localUrl = process.env.PGHOST
  ? `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`
  : null;

const databaseUrl = localUrl ?? process.env.DATABASE_URL!;
const hostname = new URL(databaseUrl).hostname;
const isNeon = hostname.endsWith("neon.tech");

function createDb() {
  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: databaseUrl });
    return { db: neonDrizzle({ client: pool, schema }), pool };
  }
  // Local or standard Postgres — disable SSL for local hosts, require for remote
  const isLocal = hostname === "localhost" || hostname === "helium" || hostname === "127.0.0.1";
  const sslOption = isLocal ? false : ("require" as const);
  const client = postgres(databaseUrl, { ssl: sslOption, prepare: false });
  return { db: pgDrizzle(client, { schema }), pool: undefined };
}

const { db, pool } = createDb();

export { db, pool };
