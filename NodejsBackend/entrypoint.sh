#!/bin/sh
set -e

mkdir -p uploads

echo "Running versioned migrations..."
if NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma migrate deploy; then
  echo "Migrations applied."
else
  echo "WARNING: 'prisma migrate deploy' failed (likely a pre-migration database)."
  echo "Falling back to 'prisma db push' for compatibility; resolve by baselining (see prisma/BASELINE.md)."
  NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma db push --skip-generate
fi

# Seeding must never overwrite operational data: only seed on explicit request.
# Set SEED_ON_BOOT=true for the very first deploy of an empty database.
if [ "${SEED_ON_BOOT}" = "true" ]; then
  echo "Seeding database (SEED_ON_BOOT=true)..."
  node dist/seed.js
else
  echo "Skipping seed (set SEED_ON_BOOT=true to seed an empty database)."
fi

echo "Running idempotent normalization backfill..."
node dist/scripts/run-backfill.js || echo "WARNING: backfill failed; see logs. Application will start with legacy data paths."

echo "Starting server..."
node dist/index.js
