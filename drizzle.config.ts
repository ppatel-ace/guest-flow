import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL && !process.env.PGHOST) {
  throw new Error("DATABASE_URL or PGHOST must be set. Did you forget to provision a database?");
}

const localUrl = process.env.PGHOST
  ? `postgresql://${process.env.PGUSER ?? "postgres"}:${process.env.PGPASSWORD ?? ""}@${process.env.PGHOST}:${process.env.PGPORT ?? 5432}/${process.env.PGDATABASE ?? "postgres"}`
  : null;

const databaseUrl = localUrl ?? process.env.DATABASE_URL!;
const hostname = new URL(databaseUrl).hostname;
const isNeon = hostname.endsWith("neon.tech");
const isLocal = hostname === "localhost" || hostname === "helium" || hostname === "127.0.0.1";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: isNeon ? "require" : (isLocal ? false : "require"),
  },
});
