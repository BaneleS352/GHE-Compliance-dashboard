-- Counterparty identity: one row per (organizationId, name) for
-- organisation-scoped counterparties.
--
-- Identity policy (see docs/DATABASE-NORMALIZATION-GOAL.md):
--   * Scoped rows ("organizationId" IS NOT NULL) are unique by
--     (organizationId, name). Duplicates are reconciled below.
--   * Global rows ("organizationId" IS NULL) are intentionally exempt:
--     PostgreSQL partial indexes cannot enforce uniqueness across NULLs,
--     and shared/global counterparties are valid master data. This migration
--     never reads, repoints, or deletes a global row.
--
-- Canonical-row rule for each scoped duplicate group: the row with the
-- earliest "createdAt" wins; rows with NULL "createdAt" sort last
-- (NULLS LAST); ties break on smallest id. Deterministic and stable.
--
-- Contact collision policy: CounterpartyContact rows attached to a removed
-- duplicate are reparented to the canonical row. Contacts are NOT deduplicated
-- (same-named contacts on survivor and duplicate are both kept) — contact
-- identity is out of scope for this migration.
--
-- Forward-only. Each statement below runs in order against the result of the
-- previous one. Only duplicates that are fully unreferenced after repointing
-- are deleted; anything still referenced is kept (the unique index then
-- fails loudly instead of silently dropping data — fix the data, don't
-- force the migration).

-- Statement 1: repoint declarations from scoped duplicates to the canonical row.
WITH ranked AS (
  SELECT id, "organizationId", name,
         row_number() OVER (
           PARTITION BY "organizationId", name
           ORDER BY "createdAt" NULLS LAST, id
         ) AS rn
  FROM "Counterparty"
  WHERE "organizationId" IS NOT NULL
),
canonical AS (
  SELECT "organizationId", name, id AS keep_id FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT "organizationId", name, id AS loser_id FROM ranked WHERE rn > 1
)
UPDATE "Declaration" d
SET "counterpartyId" = c.keep_id
FROM duplicates dup
JOIN canonical c
  ON c."organizationId" = dup."organizationId"
 AND c.name = dup.name
WHERE d."counterpartyId" = dup.loser_id;

-- Statement 2: reparent contacts from scoped duplicates to the canonical row.
WITH ranked AS (
  SELECT id, "organizationId", name,
         row_number() OVER (
           PARTITION BY "organizationId", name
           ORDER BY "createdAt" NULLS LAST, id
         ) AS rn
  FROM "Counterparty"
  WHERE "organizationId" IS NOT NULL
),
canonical AS (
  SELECT "organizationId", name, id AS keep_id FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT "organizationId", name, id AS loser_id FROM ranked WHERE rn > 1
)
UPDATE "CounterpartyContact" cc
SET "counterpartyId" = c.keep_id
FROM duplicates dup
JOIN canonical c
  ON c."organizationId" = dup."organizationId"
 AND c.name = dup.name
WHERE cc."counterpartyId" = dup.loser_id;

-- Statement 3: delete scoped duplicates that are now unreferenced.
-- Referenced survivors are kept; the unique index below will fail loudly
-- on any remaining duplicate so the data can be fixed instead of dropped.
WITH ranked AS (
  SELECT id, "organizationId", name,
         row_number() OVER (
           PARTITION BY "organizationId", name
           ORDER BY "createdAt" NULLS LAST, id
         ) AS rn
  FROM "Counterparty"
  WHERE "organizationId" IS NOT NULL
),
duplicates AS (
  SELECT id AS loser_id FROM ranked WHERE rn > 1
)
DELETE FROM "Counterparty" c
USING duplicates dup
WHERE c.id = dup.loser_id
  AND NOT EXISTS (SELECT 1 FROM "Declaration" d WHERE d."counterpartyId" = c.id)
  AND NOT EXISTS (SELECT 1 FROM "CounterpartyContact" cc WHERE cc."counterpartyId" = c.id);

-- Statement 4: enforce scoped uniqueness going forward.
-- Partial index: only rows with a non-null organizationId are constrained,
-- so global counterparties remain allowed.
CREATE UNIQUE INDEX IF NOT EXISTS "Counterparty_name_org_unique"
  ON "Counterparty"("name", "organizationId")
  WHERE "organizationId" IS NOT NULL;
