import { runMigrations } from "../server/migrate";

runMigrations().catch((error: unknown) => {
  console.error("Database migration setup failed", error);
  process.exitCode = 1;
});
