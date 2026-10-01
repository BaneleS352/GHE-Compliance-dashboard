-- 0008_department_id_only: remove the duplicated User.department text column.
--
-- departmentId -> Department is the sole department source of truth
-- (single-source-of-truth rule: a relation is not a reason to duplicate its
-- descriptive fields). API/UI display values derive from the related
-- Department record; DeclarationSnapshot keeps its own immutable department
-- history column, which is unaffected.
--
-- Backfill links same-organization departments by name before the drop. Rows
-- without a match — including global NULL-org users, who cannot link the
-- organization-scoped Department table — keep NULL departmentId and resolve
-- to an empty display value.

UPDATE "User" u SET "departmentId" = d."id"
FROM "Department" d
WHERE u."departmentId" IS NULL
  AND u."organizationId" IS NOT NULL
  AND d."organizationId" = u."organizationId"
  AND d."name" = u."department";

ALTER TABLE "User" DROP COLUMN "department";
