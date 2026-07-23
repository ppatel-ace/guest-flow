# AGENTS.md

## Cursor Cloud specific instructions

GuestFlow is a Vite (React) + Express + Drizzle app served on a single port. Standard commands live in `package.json` (`npm run dev`, `npm run build`, `npm run check`, `npm run db:push`); there is no lint/test script.

Environment specifics for this VM:

- PostgreSQL runs locally. Start it (if not running) with `sudo pg_ctlcluster 16 main start`. Dev role is `ace` / `ace`; this app uses the `guestflow` database.
- The app does NOT auto-load `.env` (it expects env vars in the process, like Replit). A `.env` is already present in the working tree — start the dev server with it sourced:
  `set -a && . ./.env && set +a && npm run dev`
- Runs on port `5000` (default). Apply the schema with `npm run db:push` before first run.
- No SSO is configured locally, so the built-in local login works: username `admin`, password `admin`. The public homepage is the customer check-in page.
