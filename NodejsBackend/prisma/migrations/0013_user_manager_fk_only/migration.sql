-- 0013_user_manager_fk_only
-- User.managerId is the authoritative manager relationship. Keep the legacy
-- lineManager API display property derived from this FK; declaration
-- snapshots retain historical manager names independently.

DO $$
BEGIN
  -- Recover only unambiguous legacy labels before dropping the duplicate
  -- column. A name must resolve to exactly one same-organization or global
  -- manager. Ambiguous or unresolved labels require manual repair.
  IF EXISTS (
    SELECT 1
    FROM "User" u
    WHERE u."managerId" IS NULL
      AND NULLIF(btrim(u."lineManager"), '') IS NOT NULL
      AND (
        SELECT count(*)
        FROM "User" m
        WHERE lower(btrim(m."name")) = lower(btrim(u."lineManager"))
          AND m."id" <> u."id"
          AND (m."organizationId" IS NULL OR m."organizationId" IS NOT DISTINCT FROM u."organizationId")
      ) <> 1
  ) THEN
    RAISE EXCEPTION '0013 blocked: a legacy lineManager label does not resolve to exactly one same-organization/global user; repair managerId before migration';
  END IF;
END $$;

WITH manager_matches AS (
  SELECT u."id" AS "userId", min(m."id") AS "managerId", count(m."id") AS "matchCount"
  FROM "User" u
  JOIN "User" m
    ON lower(btrim(m."name")) = lower(btrim(u."lineManager"))
   AND m."id" <> u."id"
   AND (m."organizationId" IS NULL OR m."organizationId" IS NOT DISTINCT FROM u."organizationId")
  WHERE u."managerId" IS NULL
    AND NULLIF(btrim(u."lineManager"), '') IS NOT NULL
  GROUP BY u."id"
)
UPDATE "User" u
SET "managerId" = matches."managerId"
FROM manager_matches matches
WHERE u."id" = matches."userId" AND matches."matchCount" = 1;

DROP INDEX IF EXISTS "User_lineManager_idx";
ALTER TABLE "User" DROP COLUMN "lineManager";
