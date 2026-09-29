# PostgreSQL deployment runbook (Phases 0–5)

`prisma/migrations/0000_baseline` captures the pre-normalization schema that
production previously created with `prisma db push`. `0001_normalization`
adds the relational model, `0002_rule_fk` reconciles the
`WorkflowInstance -> WorkflowRule` foreign key, `0003_counterparty_unique`
reconciles duplicate organisation-scoped counterparties and enforces scoped
uniqueness, and `0004_monthly_eventdate` moves the monthly reporting view from
the legacy text date to the canonical `eventDate` column. All migrations are
forward-only; rollback is backup/restore, never DDL reversal.

## Roles

- **Release operator** (human or deploy pipeline): takes the backup, runs the
  one-time baseline/resolve commands below, and approves the deploy.
- **Container entrypoint**: runs `prisma migrate deploy`, the idempotent
  backfill, then the API. It fails fast — a failed migration or backfill
  stops the container with a non-zero exit. There is no `db push` fallback.

## 0. Back up first (required before any migration)

```sh
pg_dump "postgresql://ghe_user:ghe_password@db:5432/ghe_compliance?schema=public" \
  > backup_pre_$(date +%Y%m%d_%H%M%S).sql
# Verify the dump restores: pg_restore/psql into a scratch database.
```

## 1. New database

No action needed. The Docker entrypoint runs `prisma migrate deploy`, which
applies `0000_baseline` + `0001_normalization` + `0002_rule_fk` +
`0003_counterparty_unique` + `0004_monthly_eventdate` in order,
then the backfill, then the server.

```sh
SEED_ON_BOOT=true docker compose up -d --build   # empty database, first boot only
```

## 2. Existing production database (created by `db push`)

One-time procedure, run by the release operator:

```sh
# 1. Point DATABASE_URL at the existing production database (backup taken above).
# 2. Mark the baseline applied without running its DDL:
npx prisma migrate resolve --applied "0000_baseline"

# 3. Confirm the plan (must list 0001_normalization through 0004_monthly_eventdate):
npx prisma migrate status

# 4. Apply (or let the container entrypoint do it on next deploy):
npx prisma migrate deploy

# 5. Backfill + reconcile (idempotent; prints the mapping report):
npm run db:backfill

# 6. Verify zero drift before declaring the deploy healthy:
npm run db:verify
```

## 3. Verification queries (post-deploy health)

```sh
npx prisma migrate status            # must report "Database schema is up to date"
npm run db:verify                    # must print "OK: relational model matches legacy columns"
```

Spot-check in SQL:

```sql
-- every instance resolves to a live rule (or null after a rule delete)
SELECT COUNT(*) FROM "WorkflowInstance" i
 LEFT JOIN "WorkflowRule" r ON r."id" = i."ruleId"
 WHERE i."ruleId" IS NOT NULL AND r."id" IS NULL;  -- must be 0
-- step rows mirror the JSON cache
SELECT COUNT(*) FROM "WorkflowInstance";           -- N instances
SELECT COUNT(DISTINCT "instanceId") FROM "WorkflowInstanceStep";  -- must also be N
-- no scoped counterparty duplicates remain (global org-null rows exempt)
SELECT "organizationId", "name", COUNT(*)
FROM "Counterparty" WHERE "organizationId" IS NOT NULL
GROUP BY "organizationId", "name" HAVING COUNT(*) > 1;  -- must be 0 rows
-- every declaration counterparty link resolves
SELECT COUNT(*) FROM "Declaration" d
  LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId"
  WHERE d."counterpartyId" IS NOT NULL AND c."id" IS NULL;  -- must be 0
-- monthly view buckets from the canonical eventDate column
SELECT "month", "count" FROM "v_declarations_monthly" ORDER BY "month" LIMIT 5;
```

## 4. Counterparty duplicate preflight (before deploying 0003)

`0003_counterparty_unique` reconciles duplicates itself (canonical = earliest
`createdAt`, NULLs last, id tiebreak; declarations/contacts repointed; only
unreferenced duplicates deleted; global org-null rows untouched), but run this
preflight on the backup first so the reconciliation is reviewed, not a surprise:

```sql
-- scoped duplicate groups and how many declarations/contacts each touches
SELECT c."organizationId", c."name",
       COUNT(*) AS rows,
       COUNT(d."id") AS declarations,
       COUNT(cc."id") AS contacts
FROM "Counterparty" c
LEFT JOIN "Declaration" d ON d."counterpartyId" = c."id"
LEFT JOIN "CounterpartyContact" cc ON cc."counterpartyId" = c."id"
WHERE c."organizationId" IS NOT NULL
GROUP BY c."organizationId", c."name"
HAVING COUNT(*) > 1;
-- expected post-deploy: each group keeps exactly one row; declarations and
-- contacts still resolve (see verification queries above); global rows unchanged
SELECT COUNT(*) FROM "Counterparty" WHERE "organizationId" IS NULL;  -- unchanged count
```

## 5. Failure / rollback

- **Migration failure**: the entrypoint exits non-zero and the old container
  keeps serving (compose does not replace a container whose entrypoint
  fails). Inspect `docker compose logs backend`, fix the cause, restore the
  backup if the database was partially migrated, redeploy.
- **Backfill/verify failure**: startup stops. Do not bypass — restore the
  backup if data was affected, fix the cause, redeploy.
- **Rollback**: restore the pre-deploy `pg_dump` backup and redeploy the
  previous image tag. Application compatibility is maintained because the
  API contract never changed (legacy columns remain populated).

## Safety rules

- Migrations are forward-only. Rollback is backup/restore, not DDL reversal.
- `node dist/seed.js` never runs automatically in production; the entrypoint
  only seeds when `SEED_ON_BOOT=true` (first boot of an empty database).
- `npm run db:backfill` is idempotent and safe to re-run; review its
  reconciliation report (`invalidDates`, missing references, rejected values)
  before retiring any legacy column (Phase 5, see RETIREMENT.md).
- SQLite dev/tests keep using `prisma db push` from `schema.prisma`; the
  `Dockerfile` rewrites the provider to `postgresql` at build time so the
  same schema deploys with versioned migrations in production.
- PostgreSQL behaviour (migrations, views, backfill, scoping, FKs) is covered
  by `npm run pg:test` (needs `TEST_PG_DATABASE_URL`) and the
  `postgres-normalization` CI job.
