#!/bin/sh
# Production entrypoint: versioned migrations only.
#
# A failed migration MUST stop the container (non-zero exit). There is
# intentionally no `prisma db push` fallback: pushing schema onto a partially
# migrated or incompatible production database can corrupt it and defeats
# versioned schema governance. Existing pre-migration databases must use the
# one-time baseline/resolve procedure in prisma/BASELINE.md instead.
set -e

mkdir -p uploads

echo "Running versioned migrations..."
NODE_TLS_REJECT_UNAUTHORIZED=0 ./node_modules/.bin/prisma migrate deploy
echo "Migrations applied."

# Seeding must never overwrite operational data: only seed on explicit request.
# Set SEED_ON_BOOT=true for the very first deploy of an empty database.
if [ "${SEED_ON_BOOT}" = "true" ]; then
  echo "Seeding database (SEED_ON_BOOT=true)..."
  node dist/seed.js
else
  echo "Skipping seed (set SEED_ON_BOOT=true to seed an empty database)."
fi

# The normalization backfill is an explicit, observable deployment step: its
# reconciliation report is always printed, and a failure stops startup.
# Relational rows are authoritative for workflow reads, so starting with an
# incomplete mirror is not safe. (Emergency bypass, if ever needed, requires
# an explicit code/deploy change — never a silent continue.)
echo "Running idempotent normalization backfill..."
node dist/scripts/run-backfill.js
echo "Backfill complete."

echo "Starting server..."
node dist/index.js
