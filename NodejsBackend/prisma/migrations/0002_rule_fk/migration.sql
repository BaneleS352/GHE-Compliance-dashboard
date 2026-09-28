-- Reconcile the declared WorkflowInstance -> WorkflowRule relationship.
-- Instances record which rule produced their steps; the column existed since
-- 0001_normalization but had no foreign key, so an instance could reference a
-- nonexistent rule. Additive, forward-only, no data rewrite.
--
-- Delete rule SetNull: deleting a rule must not delete historical instances;
-- new submissions resolve their rule at submit time and fail loudly if the
-- rule is missing (see workflowService.resolveRuleId).

ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_ruleId_fk"
  FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule"("id") ON DELETE SET NULL NOT VALID;
ALTER TABLE "WorkflowInstance" VALIDATE CONSTRAINT "WorkflowInstance_ruleId_fk";
CREATE INDEX IF NOT EXISTS "WorkflowInstance_ruleId_idx" ON "WorkflowInstance"("ruleId");
