-- Phase 0 baseline: matches the pre-normalization production schema that was
-- previously created with `prisma db push`. This migration is the one-time
-- baseline for existing PostgreSQL databases (see ../BASELINE.md).
-- New databases apply this plus 0001_normalization via `prisma migrate deploy`.

CREATE TABLE IF NOT EXISTS "Organization" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL UNIQUE,
  "shortCode" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "teamMemberNumber" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "lineManager" TEXT,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "User_department_idx" ON "User"("department");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_lineManager_idx" ON "User"("lineManager");
CREATE INDEX IF NOT EXISTS "User_organizationId_idx" ON "User"("organizationId");

CREATE TABLE IF NOT EXISTS "Declaration" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "employee" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "teamMemberNumber" TEXT NOT NULL,
  "lineManager" TEXT NOT NULL,
  "position" TEXT NOT NULL,
  "department" TEXT NOT NULL,
  "company" TEXT,
  "team" TEXT,
  "type" TEXT NOT NULL,
  "counterparty" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "submitted" TEXT NOT NULL,
  "approver" TEXT NOT NULL,
  "approverId" TEXT,
  "status" TEXT NOT NULL,
  "priority" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "relationship" TEXT NOT NULL,
  "receivedGiven" TEXT NOT NULL,
  "from_field" TEXT NOT NULL,
  "contactPerson" TEXT NOT NULL,
  "biddingProcess" TEXT NOT NULL,
  "contractNegotiation" TEXT,
  "occasion" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "instances" TEXT NOT NULL,
  "publicOfficial" TEXT NOT NULL,
  "substantiation" TEXT,
  "files" TEXT,
  "organizationId" TEXT REFERENCES "Organization"("id") ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS "Declaration_employeeId_idx" ON "Declaration"("employeeId");
CREATE INDEX IF NOT EXISTS "Declaration_status_idx" ON "Declaration"("status");
CREATE INDEX IF NOT EXISTS "Declaration_department_idx" ON "Declaration"("department");
CREATE INDEX IF NOT EXISTS "Declaration_approverId_idx" ON "Declaration"("approverId");
CREATE INDEX IF NOT EXISTS "Declaration_position_idx" ON "Declaration"("position");
CREATE INDEX IF NOT EXISTS "Declaration_lineManager_idx" ON "Declaration"("lineManager");
CREATE INDEX IF NOT EXISTS "Declaration_counterparty_idx" ON "Declaration"("counterparty");
CREATE INDEX IF NOT EXISTS "Declaration_organizationId_idx" ON "Declaration"("organizationId");
CREATE INDEX IF NOT EXISTS "Declaration_submitted_idx" ON "Declaration"("submitted");
CREATE INDEX IF NOT EXISTS "Declaration_date_idx" ON "Declaration"("date");
CREATE INDEX IF NOT EXISTS "Declaration_value_idx" ON "Declaration"("value");

CREATE TABLE IF NOT EXISTS "WorkflowRule" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "priority" INTEGER NOT NULL,
  "steps" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
  "declarationId" TEXT NOT NULL PRIMARY KEY,
  "steps" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "highValueThreshold" DOUBLE PRECISION NOT NULL,
  "mediumValueThreshold" DOUBLE PRECISION NOT NULL,
  "slaEscalationDays" INTEGER NOT NULL,
  "maxDeclarationsPerCounterparty" INTEGER NOT NULL,
  "maximumValue" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
  "emailTemplate" TEXT NOT NULL,
  "notificationTemplates" TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS "Dropdowns" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "data" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "ComplianceTrendPoint" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "month" TEXT NOT NULL,
  "approved" INTEGER NOT NULL,
  "declined" INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "TypeBreakdownItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "value" DOUBLE PRECISION NOT NULL,
  "color" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "ApprovalOption" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "value" TEXT NOT NULL,
  "label" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "UploadedFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "declarationId" TEXT,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "UploadedFile_declarationId_idx" ON "UploadedFile"("declarationId");
