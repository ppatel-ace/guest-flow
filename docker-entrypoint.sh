#!/bin/sh
set -e

echo "Starting application (migrations run automatically at startup)..."
exec node dist/index.cjs
