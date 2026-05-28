import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-serverless';
import postgres from 'postgres';
import { drizzle as pgDrizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import ws from "ws";
import net from "net";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Prefer DATABASE_URL (Neon/Supabase) if available; fall back to local Helium PostgreSQL.
const localUrl = process.env.PGHOST
  ? `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`
  : null;

const databaseUrl = process.env.DATABASE_URL ?? localUrl!;
const parsedUrl = new URL(databaseUrl);
const hostname = parsedUrl.hostname;
const isNeon = hostname.endsWith("neon.tech");

// Supabase hosts can be:
//   - Direct connections:  <ref>.supabase.co
//   - Pooler connections:  aws-0-<region>.pooler.supabase.com  (session/transaction mode)
// Both are covered by checking for either TLD.
//
// DATABASE_URL format: copy the connection string from the Supabase dashboard
// (Project Settings → Database → Connection String). It already includes the
// correct host and port. Supabase always gets full certificate verification
// regardless of any sslmode query parameter in the URL.
const isSupabase =
  hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");

// In Replit the serverless WebSocket driver is needed (port 6543/WSS).
// Outside Replit (e.g. Docker on Portainer) use the standard postgres driver
// so the connection goes over plain TCP on port 5432, which is typically open.
const isReplit = !!process.env.REPL_ID;

// ---------------------------------------------------------------------------
// sslmode resolution
//
// Priority order:
//   1. Supabase → always verify-full (cloud DB, security non-negotiable)
//   2. sslmode query param in DATABASE_URL → honours the operator's explicit choice
//      - "disable"                   → no SSL  (safe for Docker-internal networks)
//      - "verify-full" / "verify-ca" → SSL + certificate verification
//      - anything else               → SSL without CA pinning (require / prefer / allow)
//   3. Hostname heuristics → localhost/helium/127.0.0.1 → no SSL; everything else → require
//
// Docker/Portainer tip: add ?sslmode=disable to DATABASE_URL when your Postgres
// container is on the same Docker network and doesn't have SSL configured.
// ---------------------------------------------------------------------------
function resolveSslOption(
  sslmodeParam: string | null,
  isLocalHost: boolean
): false | "require" | { rejectUnauthorized: boolean } {
  if (isSupabase) {
    // Supabase direct connections use a trusted cert → strict by default.
    // Supabase connection poolers (PgBouncer) use a self-signed cert.
    // Add ?sslmode=require to DATABASE_URL to use SSL without CA verification
    // (needed when the pooler presents a self-signed certificate).
    if (sslmodeParam === "require") return "require";
    if (sslmodeParam === "disable") return false;
    return { rejectUnauthorized: true };
  }
  if (sslmodeParam === "disable") return false;
  if (sslmodeParam === "verify-full" || sslmodeParam === "verify-ca") return { rejectUnauthorized: true };
  if (sslmodeParam !== null) return "require";
  // No explicit sslmode — fall back to hostname heuristics.
  if (isLocalHost) return false;
  return "require";
}

function createDb() {
  if (isNeon && isReplit) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: databaseUrl });
    return { db: neonDrizzle({ client: pool, schema }), pool };
  }
  // Standard postgres driver: works for local DBs, non-Replit Neon, and any
  // other PostgreSQL-compatible host (including Docker service names like "db").
  const isLocal = hostname === "localhost" || hostname === "helium" || hostname === "127.0.0.1";
  const sslmodeParam = parsedUrl.searchParams.get("sslmode");
  const sslOption = resolveSslOption(sslmodeParam, isLocal);

  // Force IPv4 for remote hosts so Docker/Portainer environments without IPv6
  // don't get ENETUNREACH when the DNS resolves to an IPv6 address.
  // Skip the override when SSL is disabled — it's unnecessary on local networks.
  const needsSocket = sslOption !== false && !isLocal;
  const socketOption = needsSocket
    ? (opts: { host: string | string[]; port: number | number[] }) => {
        const host = Array.isArray(opts.host) ? opts.host[0] : opts.host;
        const port = Array.isArray(opts.port) ? opts.port[0] : opts.port;
        return net.createConnection({ host, port, family: 4 });
      }
    : undefined;
  const client = postgres(databaseUrl, {
    ssl: sslOption,
    prepare: false,
    ...(socketOption ? { socket: socketOption } : {}),
  });
  return { db: pgDrizzle(client, { schema }), pool: undefined };
}

const { db, pool } = createDb();

// ---------------------------------------------------------------------------
// Startup connectivity check — call this once from the server's async startup
// block so it runs before the server starts listening.  Keeping it out of
// module-level top-level await preserves CJS build compatibility.
async function checkConnection(): Promise<void> {
  if (!isSupabase) return;
  try {
    await db.execute(sql`SELECT 1`);
    console.log("[db] Supabase connection verified ✓");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    let hint = "";
    if (message.includes("self-signed") || message.includes("certificate")) {
      hint = "\n  → Append ?sslmode=require to your DATABASE_URL (pooler uses a self-signed cert).";
    } else if (message.includes("password authentication") || message.includes("password")) {
      hint = "\n  → The Supabase pooler requires the username format: postgres.<project-ref>\n  → Copy the exact Session-mode connection string from Supabase → Settings → Database.";
    }
    // Warn but do not crash — bad credentials should not prevent the dev server
    // from starting. API calls will surface the real error when they hit the DB.
    console.error(`[db] WARNING: Supabase connection check failed — ${message}${hint}`);
  }
}

export { db, pool, checkConnection };
