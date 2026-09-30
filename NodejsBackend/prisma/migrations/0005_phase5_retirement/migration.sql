-- Phase 5 cutover: retire legacy compatibility columns/tables (forward-only).
--
-- GATE (must pass before applying to any database — see prisma/RETIREMENT.md):
--   1. `npm run db:backfill` idempotent, zero unresolved required mappings.
--   2. `npm run db:verify` reports zero drift on a production-shaped copy.
--   3. Release window elapsed; backup taken; rollback = backup/restore.
--
-- Ownership decisions (goal doc Phase A): SystemConfig wins over
-- OrganizationSetting; User.role wins over AppRole/UserRole; Ref* copies
-- removed (type/status/priority stay validated strings until a
-- domain-specific FK design is approved); DeclarationFile is the only file
-- association; step rows are the only workflow state/definition.
--
-- Order: drop dependent views -> drop legacy columns -> drop retired tables
-- -> recreate all 7 reporting views on the normalized schema.

DROP VIEW IF EXISTS "v_declaration_status_summary";
DROP VIEW IF EXISTS "v_declarations_monthly";
DROP VIEW IF EXISTS "v_declaration_type_breakdown";
DROP VIEW IF EXISTS "v_workflow_current_step";
DROP VIEW IF EXISTS "v_workflow_step_sla";
DROP VIEW IF EXISTS "v_counterparty_concentration";
DROP VIEW IF EXISTS "v_high_value_declarations";

-- Declaration legacy employee-context / detail / timestamp / approver / file columns.
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "employee";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "employeeId";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "teamMemberNumber";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "lineManager";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "position";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "department";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "company";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "team";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "counterparty";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "submitted";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "approver";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "approverId";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "description";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "relationship";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "receivedGiven";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "from_field";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "contactPerson";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "biddingProcess";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "contractNegotiation";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "occasion";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "date";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "instances";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "publicOfficial";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "substantiation";
ALTER TABLE "Declaration" DROP COLUMN IF EXISTS "files";

-- Workflow JSON caches (rows are the only state/definition).
ALTER TABLE "WorkflowRule" DROP COLUMN IF EXISTS "steps";
ALTER TABLE "WorkflowInstance" DROP COLUMN IF EXISTS "steps";

-- Duplicate file FK (DeclarationFile join is the only association).
ALTER TABLE "UploadedFile" DROP COLUMN IF EXISTS "declarationId";

-- Retired compatibility tables.
DROP TABLE IF EXISTS "OrganizationSetting";
DROP TABLE IF EXISTS "UserRole";
DROP TABLE IF EXISTS "AppRole";
DROP TABLE IF EXISTS "RefDeclarationType";
DROP TABLE IF EXISTS "RefDeclarationStatus";
DROP TABLE IF EXISTS "RefPriority";
DROP TABLE IF EXISTS "RefRelationshipType";
DROP TABLE IF EXISTS "RefDirection";
DROP TABLE IF EXISTS "RefWorkflowStatus";
DROP TABLE IF EXISTS "Dropdowns";
DROP TABLE IF EXISTS "ComplianceTrendPoint";
DROP TABLE IF EXISTS "TypeBreakdownItem";

-- Reporting views owned by migrations (application roles need only SELECT).
CREATE VIEW "v_declaration_status_summary" AS
  SELECT "organizationId" AS "organizationId", "status" AS "status",
         COUNT(*) AS "count", SUM("value") AS "totalValue"
  FROM "Declaration" GROUP BY "organizationId", "status";

CREATE VIEW "v_declarations_monthly" AS
  SELECT "organizationId" AS "organizationId",
         to_char("eventDate", 'YYYY-MM') AS "month",
         COUNT(*) AS "count",
         SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
         SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
         SUM("value") AS "totalValue"
  FROM "Declaration" WHERE "eventDate" IS NOT NULL
  GROUP BY "organizationId", to_char("eventDate", 'YYYY-MM');

CREATE VIEW "v_declaration_type_breakdown" AS
  SELECT "organizationId" AS "organizationId", "type" AS "type",
         COUNT(*) AS "count", SUM("value") AS "totalValue"
  FROM "Declaration" GROUP BY "organizationId", "type";

CREATE VIEW "v_workflow_current_step" AS
  SELECT "declarationId", "stepOrder", "role", "assigneeId", "assigneeName", "status"
  FROM "WorkflowInstanceStep" WHERE "status" = 'pending';

CREATE VIEW "v_workflow_step_sla" AS
  SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
         d."eventDate" AS "eventDate"
  FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."id" = s."declarationId"
  WHERE s."decidedAt" IS NOT NULL;

CREATE VIEW "v_counterparty_concentration" AS
  SELECT d."organizationId" AS "organizationId",
         COALESCE(c."name", 'Unknown') AS "counterparty",
         COUNT(*) AS "count", SUM(d."value") AS "totalValue",
         AVG(d."value") AS "avgValue"
  FROM "Declaration" d LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId"
  GROUP BY d."organizationId", COALESCE(c."name", 'Unknown');

CREATE VIEW "v_high_value_declarations" AS
  SELECT d."id" AS "id", s."declarerName" AS "employee",
         s."managerDisplayName" AS "lineManager", s."department" AS "department",
         d."type" AS "type", COALESCE(c."name", 'Unknown') AS "counterparty",
         d."value" AS "value", d."eventDate" AS "date", d."status" AS "status",
         d."organizationId" AS "organizationId"
  FROM "Declaration" d
  LEFT JOIN "DeclarationSnapshot" s ON s."declarationId" = d."id"
  LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId";
