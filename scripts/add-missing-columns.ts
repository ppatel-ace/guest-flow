import postgres from "postgres";
import net from "net";

const url = process.env.DATABASE_URL as string;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const parsed = new URL(url);
const isSupabase =
  parsed.hostname.endsWith(".supabase.co") ||
  parsed.hostname.endsWith(".supabase.com");
const sslmodeParam = parsed.searchParams.get("sslmode");
const isLocal =
  parsed.hostname === "localhost" ||
  parsed.hostname === "127.0.0.1" ||
  parsed.hostname === "helium";

function resolveSsl() {
  if (isSupabase) {
    if (sslmodeParam === "require") return "require" as const;
    if (sslmodeParam === "disable") return false as const;
    return { rejectUnauthorized: true };
  }
  if (sslmodeParam === "disable") return false as const;
  if (sslmodeParam !== null) return "require" as const;
  if (isLocal) return false as const;
  return "require" as const;
}

const sslOption = resolveSsl();
const needsSocket = sslOption !== false && !isLocal;

const client = postgres(url, {
  ssl: sslOption,
  prepare: false,
  ...(needsSocket
    ? {
        socket: (opts: { host: string | string[]; port: number | number[] }) => {
          const host = Array.isArray(opts.host) ? opts.host[0] : opts.host;
          const port = Array.isArray(opts.port) ? opts.port[0] : opts.port;
          return net.createConnection({ host, port, family: 4 });
        },
      }
    : {}),
});

async function run() {
  try {
    await client`ALTER TABLE gf_kiosk_devices ADD COLUMN IF NOT EXISTS default_location text`;
    console.log("kiosk_devices.default_location OK");
    await client`ALTER TABLE gf_kiosk_devices ADD COLUMN IF NOT EXISTS location_source text`;
    console.log("kiosk_devices.location_source OK");
    await client`ALTER TABLE gf_leads ADD COLUMN IF NOT EXISTS location text`;
    console.log("leads.location OK");
    await client`ALTER TABLE gf_kiosk_devices ADD COLUMN IF NOT EXISTS native_device_name text`;
    console.log("kiosk_devices.native_device_name OK");
    console.log("All columns verified.");
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
