-- 0009_domain_checks: enforce stable domain values at the database level.
--
-- Application validation (zod + fixed lists) rejects these values first, but
-- writers reaching past the API (scripts, fixtures, future integrations)
-- must face the same rules. Priority, relationship, direction, and the
-- Yes/No-style detail fields stay validated strings per the ownership
-- decisions; only the workflow-critical domains are CHECK-constrained here.

-- Declaration lifecycle and category.
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_status_check"
  CHECK ("status" IN ('Draft', 'Pending', 'Approved', 'Declined', 'Escalated', 'Returned'));
ALTER TABLE "Declaration" ADD CONSTRAINT "Declaration_type_check"
  CHECK ("type" IN ('Gift', 'Hospitality', 'Entertainment'));

-- Workflow step state and lane roles (instance rows and rule definitions).
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_status_check"
  CHECK ("status" IN ('pending', 'approved', 'declined', 'returned', 'skipped'));
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_role_check"
  CHECK ("role" IN ('lineManager', 'hr'));
ALTER TABLE "WorkflowRuleStep" ADD CONSTRAINT "WorkflowRuleStep_role_check"
  CHECK ("role" IN ('lineManager', 'hr'));
