#!/bin/bash
set -e
npm install
# Replit rewrites lockfile tarball URLs to an internal host; normalize before commit.
if grep -q 'package-firewall.replit.local' package-lock.json; then
  sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g; s|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json
fi
npm run db:push
