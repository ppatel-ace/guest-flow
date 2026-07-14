import postgres from "postgres";

/** TLS only for cloud Postgres; Synology/on-prem uses plain TCP. */
export function postgresSsl(url: string): false | { rejectUnauthorized: boolean } {
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (process.env.DATABASE_SSL === "false") return false;

  try {
    const normalized = url.replace(/^postgres(ql)?:\/\//, "http://");
    const host = new URL(normalized).hostname.toLowerCase();
    const cloudHost =
      host.includes("neon.tech") ||
      host.includes("supabase.co") ||
      host.includes("amazonaws.com");
    return cloudHost ? { rejectUnauthorized: false } : false;
  } catch {
    return false;
  }
}

export function createDb(databaseUrl: string) {
  const parsed = new URL(databaseUrl);
  parsed.searchParams.delete("sslmode");
  return postgres(parsed.toString(), {
    ssl: postgresSsl(databaseUrl),
    max: 5,
  });
}
