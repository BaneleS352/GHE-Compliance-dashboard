# PostgreSQL deployment runbook (numeric identifier cutover complete)

`prisma/migrations/0000_baseline` captures the pre-normalization schema.
`0001_normalization` adds the relational model, `0002_rule_fk` reconciles the
`WorkflowInstance -> WorkflowRule` foreign key, `0003_counterparty_unique`
reconciles duplicate organisation-scoped counterparties and enforces scoped
uniqueness, `0004_monthly_eventdate` moves the monthly reporting view to the
canonical `eventDate` column, `0005_phase5_retirement` retires the legacy
compatibility columns/tables and places all 7 reporting views under migration
ownership, `0006_numeric_keys` converts every internal primary/foreign key
from TEXT to native BIGINT identity columns, `0007_step_identity` enforces
workflow declaration identity, `0008_department_id_only` removes the
duplicated user department field, and `0009_domain_checks` adds database
domain constraints. `Declaration.id` (`GHE-YYYY-NNNNNN`) stays the
public text reference with an internal numeric `declarationPk` that all child
tables reference. All migrations are forward-only; rollback is
backup/restore, never DDL reversal.

## Roles

- **Release operator** (human or deploy pipeline): takes the backup, runs the
  one-time baseline/resolve commands below, and approves the deploy.
- **Container entrypoint**: runs `prisma migrate deploy`, seeds an empty
  database only when `SEED_ON_BOOT=true`, then starts the API. It fails fast
  — a failed migration stops the container with a non-zero exit. There is no
  `db push` fallback and no SQLite path (PostgreSQL is the only provider).

## 0. Back up first (required before any migration)

```sh
pg_dump "postgresql://ghe_user:ghe_password@db:5432/ghe_compliance?schema=public" \
  > backup_pre_$(date +%Y%m%d_%H%M%S).sql
# Verify the dump restores: pg_restore/psql into a scratch database.
```

## 1. New database

No action needed. The Docker entrypoint runs `prisma migrate deploy`, which
applies `0000_baseline` through `0009_domain_checks` in order, then the server.

```sh
SEED_ON_BOOT=true docker compose up -d --build   # empty database, first boot only
```

## 2. Existing database (pre-numeric schema)

One-time procedure, run by the release operator:

```sh
# 1. Point DATABASE_URL at the existing database (backup taken above).
# 2. If the database predates versioned migrations entirely, mark the baseline
#    applied without running its DDL:
npx prisma migrate resolve --applied "0000_baseline"

# 3. Confirm the plan (must list every pending migration through 0009_domain_checks):
npx prisma migrate status

# 4. Apply on a COPY first: 0006 fails loudly on any unmapped legacy
#    reference (orphan user/org/rule/counterparty/file link). Resolve the
#    reported rows, then apply (or let the container entrypoint do it):
npx prisma migrate deploy
```

0006 mapping rules (deterministic, no data preserved beyond the mapping):
row_number() ordering per table (createdAt/id, rule/order, declaration
reference); global (NULL-org) counterparties exempt from scoped identity;
sequences restarted past mapped rows. Disposable development/test databases
should be reset and reseeded instead of migrated.

## 3. Verification queries (post-deploy health)

```sh
npx prisma migrate status            # must report "Database schema is up to date"
```

Spot-check in SQL:

```sql
-- every internal PK is BIGINT identity; only the public declaration
-- reference (plus SystemConfig/ApprovalOption code lists) stays text
SELECT table_name FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'id' AND data_type = 'text';
-- must return no rows (Declaration.id is the deliberate text exception —
-- exclude it explicitly when auditing: AND table_name <> 'Declaration')
-- every instance resolves to a live rule (or null after a rule delete)
SELECT COUNT(*) FROM "WorkflowInstance" i
 LEFT JOIN "WorkflowRule" r ON r."id" = i."ruleId"
 WHERE i."ruleId" IS NOT NULL AND r."id" IS NULL;  -- must be 0
-- every instance has step rows
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
-- every declaration has its snapshot + detail rows (via declarationPk)
SELECT COUNT(*) FROM "Declaration" d
  LEFT JOIN "DeclarationSnapshot" s ON s."declarationPk" = d."declarationPk"
  WHERE s."declarationPk" IS NULL;  -- must be 0
SELECT COUNT(*) FROM "Declaration" d
  LEFT JOIN "DeclarationDetail" t ON t."declarationPk" = d."declarationPk"
  WHERE t."declarationPk" IS NULL;  -- must be 0
-- monthly view buckets from the canonical eventDate column
SELECT "month", "count" FROM "v_declarations_monthly" ORDER BY "month" LIMIT 5;
```

## 4. Counterparty duplicate preflight (before deploying 0003 and later)

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
- **Rollback**: restore the pre-deploy `pg_dump` backup and redeploy the
  previous image tag. The user-facing declaration/approval flows keep the same
  response shapes (numeric ids are JSON numbers); in practice, restore the
  backup that matches the image tag — a pre-numeric build cannot serve a
  numeric-key database.

## Safety rules

- Migrations are forward-only. Rollback is backup/restore, not DDL reversal.
- `node dist/seed.js` never runs automatically in production; the entrypoint
  only seeds when `SEED_ON_BOOT=true` (first boot of an empty database).
- PostgreSQL behaviour (migrations, views, scoping, FKs, numeric keys) is
  covered by `npm run pg:test` (needs `TEST_PG_DATABASE_URL`), the
  `npm run pg:smoke` clean-database smoke test (needs `SMOKE_PG_DATABASE_URL`),
  and the `postgres-normalization` CI job.
