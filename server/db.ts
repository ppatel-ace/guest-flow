import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const databaseUrl = process.env.DATABASE_URL;
const hostname = new URL(databaseUrl).hostname;
const isNeon = hostname.endsWith("neon.tech");

function createDb() {
  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: databaseUrl });
    return { db: neonDrizzle({ client: pool, schema }), pool };
  }
  // prepare: false is required for Supabase pooler (PgBouncer) and safe for all standard Postgres
  const client = postgres(databaseUrl, { ssl: "require", prepare: false });
  return { db: pgDrizzle(client, { schema }), pool: undefined };
}

const { db, pool } = createDb();

export { db, pool };
