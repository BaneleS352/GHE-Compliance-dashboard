-- 0012_financial_precision_integrity
-- Use exact decimal storage for money and enforce the remaining reviewed
-- vocabularies and scoped uniqueness. Refuse implicit rounding or duplicate
-- cleanup so an operator can reconcile populated databases before retrying.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "Declaration"
    WHERE "value"::numeric <> round("value"::numeric, 2)
  ) THEN
    RAISE EXCEPTION '0012 blocked: Declaration.value contains amounts with more than two decimal places; reconcile before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "SystemConfig"
    WHERE "highValueThreshold"::numeric <> round("highValueThreshold"::numeric, 2)
       OR "mediumValueThreshold"::numeric <> round("mediumValueThreshold"::numeric, 2)
       OR "maximumValue"::numeric <> round("maximumValue"::numeric, 2)
  ) THEN
    RAISE EXCEPTION '0012 blocked: SystemConfig monetary values contain more than two decimal places; reconcile before migration';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Declaration" WHERE "priority" NOT IN ('Low', 'Medium', 'High')
  ) THEN
    RAISE EXCEPTION '0012 blocked: Declaration.priority contains values outside Low/Medium/High';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "User"
    WHERE "organizationId" IS NOT NULL AND btrim("teamMemberNumber") <> ''
    GROUP BY "organizationId", lower(btrim("teamMemberNumber"))
    HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM "User"
    WHERE "organizationId" IS NULL AND btrim("teamMemberNumber") <> ''
    GROUP BY lower(btrim("teamMemberNumber"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0012 blocked: duplicate non-empty teamMemberNumber values exist within an organization';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "Department"
    WHERE "code" IS NOT NULL AND btrim("code") <> ''
    GROUP BY "organizationId", lower(btrim("code"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0012 blocked: duplicate non-empty Department.code values exist within an organization';
  END IF;
END $$;

-- These reporting views expose or aggregate Declaration.value. PostgreSQL
-- cannot change the underlying column type while the views depend on it, so
-- recreate them after the Decimal conversion.
DROP VIEW "v_declaration_status_summary";
DROP VIEW "v_declarations_monthly";
DROP VIEW "v_declaration_type_breakdown";
DROP VIEW "v_counterparty_concentration";
DROP VIEW "v_high_value_declarations";

ALTER TABLE "Declaration"
  ALTER COLUMN "value" TYPE numeric(19,2) USING "value"::numeric(19,2);
ALTER TABLE "SystemConfig"
  ALTER COLUMN "highValueThreshold" TYPE numeric(19,2) USING "highValueThreshold"::numeric(19,2),
  ALTER COLUMN "mediumValueThreshold" TYPE numeric(19,2) USING "mediumValueThreshold"::numeric(19,2),
  ALTER COLUMN "maximumValue" TYPE numeric(19,2) USING "maximumValue"::numeric(19,2);

ALTER TABLE "Declaration"
  ADD CONSTRAINT "Declaration_value_nonnegative_check" CHECK ("value" >= 0),
  ADD CONSTRAINT "Declaration_priority_check" CHECK ("priority" IN ('Low', 'Medium', 'High'));
ALTER TABLE "SystemConfig"
  ADD CONSTRAINT "SystemConfig_highValueThreshold_nonnegative_check" CHECK ("highValueThreshold" >= 0),
  ADD CONSTRAINT "SystemConfig_mediumValueThreshold_nonnegative_check" CHECK ("mediumValueThreshold" >= 0),
  ADD CONSTRAINT "SystemConfig_maximumValue_positive_check" CHECK ("maximumValue" > 0);

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
  LEFT JOIN "DeclarationSnapshot" s ON s."declarationPk" = d."declarationPk"
  LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId";

CREATE UNIQUE INDEX "User_org_teamMemberNumber_unique"
  ON "User" ("organizationId", lower(btrim("teamMemberNumber")))
  WHERE "organizationId" IS NOT NULL AND btrim("teamMemberNumber") <> '';
CREATE UNIQUE INDEX "User_global_teamMemberNumber_unique"
  ON "User" (lower(btrim("teamMemberNumber")))
  WHERE "organizationId" IS NULL AND btrim("teamMemberNumber") <> '';
CREATE UNIQUE INDEX "Department_org_code_unique"
  ON "Department" ("organizationId", lower(btrim("code")))
  WHERE "code" IS NOT NULL AND btrim("code") <> '';

-- Retained history has no parent/actor FKs by design: deleting a draft or
-- retiring a user/organization must not erase who changed a declaration.
CREATE TABLE "DeclarationAuditEvent" (
  "id" BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "declarationPk" BIGINT NOT NULL,
  "declarationId" TEXT NOT NULL,
  "organizationId" BIGINT,
  "actorUserId" BIGINT,
  "actorName" TEXT,
  "action" TEXT NOT NULL,
  "changedFields" TEXT[] NOT NULL,
  "oldValues" JSONB,
  "newValues" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "DeclarationAuditEvent_declarationPk_createdAt_idx"
  ON "DeclarationAuditEvent" ("declarationPk", "createdAt");
CREATE INDEX "DeclarationAuditEvent_organizationId_createdAt_idx"
  ON "DeclarationAuditEvent" ("organizationId", "createdAt");
CREATE INDEX "DeclarationAuditEvent_actorUserId_createdAt_idx"
  ON "DeclarationAuditEvent" ("actorUserId", "createdAt");

CREATE FUNCTION "reject_declaration_audit_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Declaration audit events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "DeclarationAuditEvent_append_only"
  BEFORE UPDATE OR DELETE ON "DeclarationAuditEvent"
  FOR EACH ROW EXECUTE FUNCTION "reject_declaration_audit_mutation"();
