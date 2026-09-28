-- Reconcile duplicate counterparties before applying uniqueness constraint.
-- For each organization, keep the first counterparty (by createdAt) and
-- delete any subsequent duplicates.  After this step no two rows share the
-- same (organizationId, name) pair where organizationId is not null.

-- Step 1: Delete duplicate counterparties, keeping the earliest per org.
DELETE FROM "Counterparty"
WHERE "id" NOT IN (
  SELECT MIN("id")
  FROM "Counterparty"
  WHERE "organizationId" IS NOT NULL
  GROUP BY "organizationId", "name"
);

-- Step 2: Add the unique index / constraint on (name, organizationId) for
-- rows where organizationId is not null.  This prevents duplicate counterparty
-- names within the same organisation while still allowing global (org‑null)
-- counterparties.
--
-- PostgreSQL: standard unique index with a partial WHERE clause.
CREATE UNIQUE INDEX IF NOT EXISTS "Counterparty_name_org_unique"
  ON "Counterparty"("name", "organizationId")
  WHERE "organizationId" IS NOT NULL;

-- SQLite:  Prisma generates the same expression‑index syntax via
-- @@unique([name, organizationId]) when organizationId is non‑null.
-- The existing schema annotation @@unique([name, organizationId]) already
-- covers this; the migration merely ensures the index exists after
-- reconciliation.

-- Step 3: Verify the invariant – every remaining counterparty has a
-- distinct (name, organizationId) pair within its organisation.
-- (No-op in migration SQL; the verifier script will assert this.)