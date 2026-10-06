#!/bin/bash
set -euo pipefail
npm install --no-audit --no-fund
# Use app migrations and app database resolution, not Drizzle's local-first db:push.
# Production mode makes migration errors fatal; it does not change database selection.
NODE_ENV=production npx tsx scripts/run-migrations.ts
npm run check
npm run build
