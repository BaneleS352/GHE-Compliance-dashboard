-- 0011_sla_org_scope: expose Declaration.organizationId in v_workflow_step_sla.
--
-- Every other reporting view carries organizationId so report endpoints can
-- scope to the caller's organization. The SLA view did not, which meant the
-- unfiltered SLA fast-path served global averages to org-scoped callers.
-- The view stays additive-only (one column); reportingViews.viewSlaRows
-- applies the caller scope via WHERE.
DROP VIEW IF EXISTS "v_workflow_step_sla";
CREATE VIEW "v_workflow_step_sla" AS
  SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
         d."eventDate" AS "eventDate", d."organizationId" AS "organizationId"
  FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."declarationPk" = s."declarationPk"
  WHERE s."decidedAt" IS NOT NULL;
