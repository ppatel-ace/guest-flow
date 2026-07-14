import pkg from "pg";
const { Pool } = pkg;
import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.PGHOST) {
    return `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`;
  }
  throw new Error("DATABASE_URL must be set");
}

function resolvePgSsl(
  databaseUrl: string
): boolean | { rejectUnauthorized: boolean } | undefined {
  const parsed = new URL(databaseUrl);
  const hostname = parsed.hostname;
  const sslmode = parsed.searchParams.get("sslmode");
  const isSupabase =
    hostname.endsWith(".supabase.co") || hostname.endsWith(".supabase.com");
  const isLocal =
    hostname === "localhost" ||
    hostname === "helium" ||
    hostname === "127.0.0.1";

  if (sslmode === "disable") return false;
  if (sslmode === "require") return { rejectUnauthorized: false };
  if (sslmode === "verify-full" || sslmode === "verify-ca")
    return { rejectUnauthorized: true };
  if (isLocal) return false;
  if (isSupabase) return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

const ALTER_SQL = `ALTER TABLE "gf_ace_pocs" ADD COLUMN IF NOT EXISTS "emails" text[] DEFAULT '{}'::text[]`;
const VERIFY_SQL = `
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'gf_ace_pocs'
  ORDER BY ordinal_position
`;

async function main() {
  const databaseUrl = buildDatabaseUrl();
  const parsedUrl = new URL(databaseUrl);
  const hostname = parsedUrl.hostname;
  const isNeon = hostname.endsWith("neon.tech");
  const isReplit = !!process.env.REPL_ID;

  if (isNeon && isReplit) {
    neonConfig.webSocketConstructor = ws;
    const pool = new NeonPool({ connectionString: databaseUrl });
    const client = await pool.connect();
    try {
      await client.query(ALTER_SQL);
      const res = await client.query(VERIFY_SQL);
      verifyResult(res.rows as { column_name: string; data_type: string }[]);
    } finally {
      client.release();
      await pool.end();
    }
  } else {
    const ssl = resolvePgSsl(databaseUrl);
    const urlForPg = new URL(databaseUrl);
    urlForPg.searchParams.delete("sslmode");
    const pool = new Pool({ connectionString: urlForPg.toString(), ssl });
    const client = await pool.connect();
    try {
      await client.query(ALTER_SQL);
      const res = await client.query(VERIFY_SQL);
      verifyResult(res.rows as { column_name: string; data_type: string }[]);
    } finally {
      client.release();
      await pool.end();
    }
  }
}

function verifyResult(
  rows: { column_name: string; data_type: string }[]
): void {
  console.log("[fix] ace_pocs columns:", rows);
  const emailsCol = rows.find((r) => r.column_name === "emails");
  if (!emailsCol) {
    throw new Error(
      "Verification failed: emails column still missing after ALTER TABLE"
    );
  }
  console.log(
    "[fix] SUCCESS — emails column present:",
    emailsCol.column_name,
    emailsCol.data_type
  );
}

main().catch((err) => {
  console.error("[fix] FAILED:", err);
  process.exit(1);
});
