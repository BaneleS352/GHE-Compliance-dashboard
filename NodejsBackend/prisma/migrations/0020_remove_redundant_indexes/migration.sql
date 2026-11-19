-- These standalone indexes duplicate the leading columns of the unique
-- indexes on (organizationId, name), (departmentId, name), and (ruleId, order).
-- The unique indexes continue to support FK cascades and scoped lookups.
DROP INDEX IF EXISTS "Department_organizationId_idx";
DROP INDEX IF EXISTS "Team_departmentId_idx";
DROP INDEX IF EXISTS "WorkflowRuleStep_ruleId_idx";
