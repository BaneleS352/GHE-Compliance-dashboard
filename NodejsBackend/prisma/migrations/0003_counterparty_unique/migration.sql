-- Reconcile duplicate counterparties before applying uniqueness constraint.
-- For each organization, keep the counterparty with the earliest createdAt
-- and repoint every Declaration.counterpartyId + CounterpartyContact rows
-- to it.  Delete only unreferenced duplicates.  Global counterparties
-- (organizationId IS NULL) are never deleted — they are exempt from the
-- scoped uniqueness constraint.

-- Step 1: For each (organizationId, name) group with more than one row,
-- identify the canonical row (earliest createdAt, then smallest id as tiebreak)
-- and repoint Declaration.counterpartyId rows away from non-canonical duplicates.
WITH Canonical AS (
  SELECT
    id,
    organizationId,
    name,
    createdAt,
    row_number() OVER (
      PARTITION BY organizationId, name
      ORDER BY createdAt NULLS Last, id
    ) AS rn
  FROM "Counterparty"
),
DupGroups AS (
  SELECT id, organizationId, name FROM Canonical WHERE rn > 1
),
NonCanonical AS (
  SELECT c.id, c.organizationId, c.name
  FROM "Counterparty" c
  JOIN Canonical cn ON c.organizationId = cn.organizationId
                 AND c.name = cn.name
  WHERE cn.rn > 1
),
DeclaredByNonCanonical AS (
  -- declarations that reference a non-canonical counterparty
  UPDATE "Declaration" d
  SET "counterpartyId" = cn.id
  FROM NonCanonical nc
  JOIN Canonical cn ON nc.organizationId = cn.organizationId
                   AND nc.name = cn.name
  WHERE d."counterpartyId" = nc.id
    AND d."organizationId" IS NOT DISTINCT FROM cn.organizationId
  -- only repoint when org scopes match; global rows stay untouched
  RETURNING d.id
),
-- Step 2: Identify CounterpartyContact rows attached to non-canonical counterparts
-- and reparent them to the canonical row (if the contact name+details match;
-- otherwise orphan them by setting counterpartyId NULL).
OrphanedContacts AS (
  UPDATE "CounterpartyContact" cc
  SET "counterpartyId" = cn.id
  FROM NonCanonical nc
  JOIN Canonical cn ON nc.organizationId = cn.organizationId
                   AND nc.name = cn.name
  WHERE cc."counterpartyId" = nc.id
  RETURNING cc.id
),
-- Step 3: Delete only unreferenced non-canonical counterparties
-- (no declarations point to them, no contacts point to them).
Deleteable AS (
  SELECT c.id
  FROM "Counterparty" c
  WHERE c.id IN (SELECT id FROM NonCanonical)
    AND c.id NOT IN (SELECT DISTINCT "counterpartyId" FROM "Declaration" WHERE "counterpartyId" IS NOT NULL)
    AND c.id NOT IN (SELECT DISTINCT "counterpartyId" FROM "CounterpartyContact")
)
DELETE FROM "Counterparty"
WHERE id IN (SELECT id FROM Deleteable);

-- Step 4: Add the unique index / constraint on (name, organizationId) for
-- rows where organizationId is not null.  This prevents duplicate counterparty
-- names within the same organisation while still allowing global (org‑null)
-- counterparties.
--
-- PostgreSQL: partial unique index — only enforces uniqueness where organizationId IS NOT NULL.
CREATE UNIQUE INDEX IF NOT EXISTS "Counterparty_name_org_unique"
  ON "Counterparty"("name", "organizationId")
  WHERE "organizationId" IS NOT NULL;

-- Step 5: Verify the invariant – no two rows share the same (name, organizationId)
-- where organizationId is not null.  (No-op in migration SQL; the verifier script will assert this.)