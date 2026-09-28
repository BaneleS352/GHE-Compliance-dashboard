# PostgreSQL baseline procedure (Phase 0)

Production previously started with `prisma db push`, so there is no migration
history on existing databases. `prisma/migrations/0000_baseline` captures that
pre-normalization schema as the one-time baseline.

## New database

No action needed. The Docker entrypoint runs `prisma migrate deploy`, which
applies `0000_baseline` + `0001_normalization` in order.

## Existing production database (created by `db push`)

Mark the baseline as already applied, then deploy the normalization migration:

```sh
# 1. Point DATABASE_URL at the existing production database.
# 2. Mark the baseline applied without running its DDL:
npx prisma migrate resolve --applied "0000_baseline"

# 3. Verify what would run next (should be only 0001_normalization):
npx prisma migrate status

# 4. Apply it (or let the container entrypoint do it on next deploy):
npx prisma migrate deploy

# 5. Backfill + reconcile (idempotent; prints the mapping report):
npm run db:backfill
```

## Safety rules

- Migrations are forward-only. Rollback is backup/restore, not DDL reversal.
- `node dist/seed.js` never runs automatically in production; the entrypoint
  only seeds when `SEED_ON_BOOT=true` (first boot of an empty database).
- `npm run db:backfill` is idempotent and safe to re-run; review its
  reconciliation report for missing references / rejected values before
  retiring any legacy column (Phase 5).
- SQLite dev/tests keep using `prisma db push` from `schema.prisma`; the
  `Dockerfile` rewrites the provider to `postgresql` at build time so the
  same schema deploys with versioned migrations in production.
