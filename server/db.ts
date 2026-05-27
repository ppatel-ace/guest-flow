import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import ws from "ws";
import net from "net";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Prefer DATABASE_URL (Neon) if available; fall back to local Helium PostgreSQL.
const localUrl = process.env.PGHOST
  ? `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`
  : null;

const databaseUrl = process.env.DATABASE_URL ?? localUrl!;
const hostname = new URL(databaseUrl).hostname;
const isNeon = hostname.endsWith("neon.tech");

// In Replit the serverless WebSocket driver is needed (port 6543/WSS).
// Outside Replit (e.g. Docker on Portainer) use the standard postgres driver
// so the connection goes over plain TCP on port 5432, which is typically open.
const isReplit = !!process.env.REPL_ID;

function createDb() {
  if (isNeon && isReplit) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: databaseUrl });
    return { db: neonDrizzle({ client: pool, schema }), pool };
  }
  // Standard postgres driver: works for local DBs, non-Replit Neon, and any
  // other PostgreSQL-compatible host.
  const isLocal = hostname === "localhost" || hostname === "helium" || hostname === "127.0.0.1";
  const sslOption = isLocal ? false : ("require" as const);
  // Force IPv4 for remote hosts so Docker/Portainer environments without IPv6
  // don't get ENETUNREACH when the DNS resolves to an IPv6 address.
  const socketOption = isLocal
    ? undefined
    : (opts: { host: string | string[]; port: number | number[] }) => {
        const host = Array.isArray(opts.host) ? opts.host[0] : opts.host;
        const port = Array.isArray(opts.port) ? opts.port[0] : opts.port;
        return net.createConnection({ host, port, family: 4 });
      };
  const client = postgres(databaseUrl, {
    ssl: sslOption,
    prepare: false,
    ...(socketOption ? { socket: socketOption } : {}),
  });
  return { db: pgDrizzle(client, { schema }), pool: undefined };
}

const { db, pool } = createDb();

export { db, pool };
