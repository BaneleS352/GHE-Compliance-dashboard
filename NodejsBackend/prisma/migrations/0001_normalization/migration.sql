-- Phase 1–4 normalization: referential integrity, timestamps, normalised
-- organisation/reference data, relational workflow audit trail, reporting views.
-- Forward-only and idempotent (IF NOT EXISTS / conditional inserts).
-- Legacy string/JSON columns are preserved; destructive removal is deferred
-- to a later Phase 5 migration after backfill verification.

-- ── Phase 2: organisation hierarchy + roles ──

CREATE TABLE IF NOT EXISTS "Department" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("organizationId", "name")
);
CREATE INDEX IF NOT EXISTS "Department_organizationId_idx" ON "Department"("organizationId");

CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "departmentId" TEXT NOT NULL REFERENCES "Department"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("departmentId", "name")
);
CREATE INDEX IF NOT EXISTS "Team_departmentId_idx" ON "Team"("departmentId");

CREATE TABLE IF NOT EXISTS "AppRole" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "UserRole" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "roleId" TEXT NOT NULL REFERENCES "AppRole"("id") ON DELETE CASCADE,
  "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("userId", "roleId")
);
CREATE INDEX IF NOT EXISTS "UserRole_userId_idx" ON "UserRole"("userId");
CREATE INDEX IF NOT EXISTS "UserRole_roleId_idx" ON "UserRole"("roleId");

CREATE TABLE IF NOT EXISTS "OrganizationSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL UNIQUE REFERENCES "Organization"("id") ON DELETE CASCADE,
  "highValueThreshold" DOUBLE PRECISION NOT NULL DEFAULT 1000,
  "slaEscalationDays" INTEGER NOT NULL DEFAULT 3,
  "notificationTemplates" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

-- ── Phase 2: reference data ──

CREATE TABLE IF NOT EXISTS "RefDeclarationType" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE, "color" TEXT);
CREATE TABLE IF NOT EXISTS "RefDeclarationStatus" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS "RefPriority" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS "RefRelationshipType" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS "RefDirection" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS "RefWorkflowStatus" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);

-- ── Phase 3: counterparties ──

CREATE TABLE IF NOT EXISTS "Counterparty" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL,
  "name" TEXT NOT NULL,
  "contactName" TEXT,
  "contactDetails" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "Counterparty_organizationId_idx" ON "Counterparty"("organizationId");
CREATE INDEX IF NOT EXISTS "Counterparty_name_idx" ON "Counterparty"("name");

CREATE TABLE IF NOT EXISTS "CounterpartyContact" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "counterpartyId" TEXT NOT NULL REFERENCES "Counterparty"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "details" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "CounterpartyContact_counterpartyId_idx" ON "CounterpartyContact"("counterpartyId");

-- ── Phase 1: new columns + FKs on existing tables ──

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "managerId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "departmentId" TEXT REFERENCES "Department"("id") ON DELETE SET NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teamId" TEXT REFERENCES "Team"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "User_managerId_idx" ON "User"("managerId");
CREATE INDEX IF NOT EXISTS "User_departmentId_idx" ON "User"("departmentId");
CREATE INDEX IF NOT EXISTS "User_teamId_idx" ON "User"("teamId");

ALTER TABLE "WorkflowRule" ADD COLUMN IF NOT EXISTS "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "WorkflowRule_organizationId_idx" ON "WorkflowRule"("organizationId");

ALTER TABLE "WorkflowInstance" ADD COLUMN IF NOT EXISTS "ruleId" TEXT;
ALTER TABLE "Declaration" ADD COLUMN IF NOT EXISTS "eventDate" DATE;
ALTER TABLE "Declaration" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ;
ALTER TABLE "Declaration" ADD COLUMN IF NOT EXISTS "declarerUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Declaration" ADD COLUMN IF NOT EXISTS "currentApproverUserId" TEXT REFERENCES "User"("id") ON DELETE SET NULL;
ALTER TABLE "Declaration" ADD COLUMN IF NOT EXISTS "counterpartyId" TEXT REFERENCES "Counterparty"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "Declaration_declarerUserId_idx" ON "Declaration"("declarerUserId");
CREATE INDEX IF NOT EXISTS "Declaration_currentApproverUserId_idx" ON "Declaration"("currentApproverUserId");
CREATE INDEX IF NOT EXISTS "Declaration_counterpartyId_idx" ON "Declaration"("counterpartyId");
CREATE INDEX IF NOT EXISTS "Declaration_eventDate_idx" ON "Declaration"("eventDate");
CREATE INDEX IF NOT EXISTS "Declaration_submittedAt_idx" ON "Declaration"("submittedAt");

ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_declaration_fk"
  FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_declaration_fk"
  FOREIGN KEY ("declarationId") REFERENCES "Declaration"("id") ON DELETE CASCADE NOT VALID;
ALTER TABLE "WorkflowInstance" VALIDATE CONSTRAINT "WorkflowInstance_declaration_fk";
ALTER TABLE "UploadedFile" VALIDATE CONSTRAINT "UploadedFile_declaration_fk";

-- ── Phase 3: relational children ──

CREATE TABLE IF NOT EXISTS "DeclarationSnapshot" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "declarationId" TEXT NOT NULL UNIQUE REFERENCES "Declaration"("id") ON DELETE CASCADE,
  "declarerName" TEXT NOT NULL,
  "employeeNumber" TEXT NOT NULL,
  "positionTitle" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "managerDisplayName" TEXT,
  "capturedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "DeclarationDetail" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "declarationId" TEXT NOT NULL UNIQUE REFERENCES "Declaration"("id") ON DELETE CASCADE,
  "description" TEXT NOT NULL,
  "occasion" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "receivedGiven" TEXT NOT NULL,
  "fromField" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "biddingProcess" TEXT NOT NULL,
  "contractNegotiation" TEXT,
  "instances" TEXT NOT NULL,
  "publicOfficial" TEXT NOT NULL,
  "substantiation" TEXT
);

CREATE TABLE IF NOT EXISTS "DeclarationFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "declarationId" TEXT NOT NULL REFERENCES "Declaration"("id") ON DELETE CASCADE,
  "fileId" TEXT NOT NULL UNIQUE REFERENCES "UploadedFile"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "DeclarationFile_declarationId_idx" ON "DeclarationFile"("declarationId");

CREATE TABLE IF NOT EXISTS "WorkflowRuleStep" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ruleId" TEXT NOT NULL REFERENCES "WorkflowRule"("id") ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  UNIQUE("ruleId", "order")
);
CREATE INDEX IF NOT EXISTS "WorkflowRuleStep_ruleId_idx" ON "WorkflowRuleStep"("ruleId");

CREATE TABLE IF NOT EXISTS "WorkflowInstanceStep" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "instanceId" TEXT NOT NULL REFERENCES "WorkflowInstance"("declarationId") ON DELETE CASCADE,
  "declarationId" TEXT NOT NULL REFERENCES "Declaration"("id") ON DELETE CASCADE,
  "stepOrder" INTEGER NOT NULL,
  "role" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "assigneeId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "assigneeName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "decision" TEXT,
  "notes" TEXT NOT NULL DEFAULT '',
  "decidedAt" TIMESTAMPTZ,
  "decidedById" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "decidedByName" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL,
  UNIQUE("instanceId", "stepOrder")
);
CREATE INDEX IF NOT EXISTS "WorkflowInstanceStep_declarationId_idx" ON "WorkflowInstanceStep"("declarationId");
CREATE INDEX IF NOT EXISTS "WorkflowInstanceStep_assigneeId_idx" ON "WorkflowInstanceStep"("assigneeId");
CREATE INDEX IF NOT EXISTS "WorkflowInstanceStep_status_idx" ON "WorkflowInstanceStep"("status");
CREATE INDEX IF NOT EXISTS "WorkflowInstanceStep_role_idx" ON "WorkflowInstanceStep"("role");

-- ── Phase 4: reporting views (read models; auth stays in the API) ──

CREATE OR REPLACE VIEW "v_declaration_status_summary" AS
  SELECT "organizationId", "status", COUNT(*) AS "count", SUM("value") AS "totalValue"
  FROM "Declaration" GROUP BY "organizationId", "status";

CREATE OR REPLACE VIEW "v_declarations_monthly" AS
  SELECT "organizationId", substr("date", 1, 7) AS "month", COUNT(*) AS "count",
         SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
         SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
         SUM("value") AS "totalValue"
  FROM "Declaration" WHERE "date" IS NOT NULL AND length("date") >= 7
  GROUP BY "organizationId", substr("date", 1, 7);

CREATE OR REPLACE VIEW "v_declaration_type_breakdown" AS
  SELECT "organizationId", "type", COUNT(*) AS "count", SUM("value") AS "totalValue"
  FROM "Declaration" GROUP BY "organizationId", "type";

CREATE OR REPLACE VIEW "v_workflow_current_step" AS
  SELECT "declarationId", "stepOrder", "role", "assigneeId", "assigneeName", "status"
  FROM "WorkflowInstanceStep" WHERE "status" = 'pending';

CREATE OR REPLACE VIEW "v_workflow_step_sla" AS
  SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
         d."eventDate" AS "eventDate", d."date" AS "legacyDate"
  FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."id" = s."declarationId"
  WHERE s."decidedAt" IS NOT NULL;

CREATE OR REPLACE VIEW "v_counterparty_concentration" AS
  SELECT "organizationId", "counterparty", COUNT(*) AS "count",
         SUM("value") AS "totalValue", AVG("value") AS "avgValue"
  FROM "Declaration" GROUP BY "organizationId", "counterparty";

CREATE OR REPLACE VIEW "v_high_value_declarations" AS
  SELECT "id", "employee", "lineManager", "department", "type",
         "counterparty", "value", "date", "status", "organizationId"
  FROM "Declaration";
