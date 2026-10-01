-- 0007_step_identity: prove workflow step/instance declaration identity.
--
-- WorkflowInstanceStep.declarationPk duplicates WorkflowInstance.declarationPk
-- (kept for reporting joins). The composite foreign key below proves both
-- values identify the same declaration: a step row can no longer reference
-- an instance of one declaration while carrying another declaration's key.
-- Names follow Prisma's canonical convention so future diffs stay minimal.
-- The superseded single-column instance FK is dropped; the declaration,
-- assignee, and decider FKs are untouched.

-- Composite unique target on the parent (id is already the PK; the pair must
-- be unique for the composite FK to reference it).
ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_id_declarationPk_key" UNIQUE ("id", "declarationPk");

-- Drop the single-column instance FK it replaces (CASCADE semantics move to
-- the composite constraint below).
ALTER TABLE "WorkflowInstanceStep" DROP CONSTRAINT IF EXISTS "WorkflowInstanceStep_instance_fk";

-- Composite identity: (instanceId, declarationPk) -> (id, declarationPk).
ALTER TABLE "WorkflowInstanceStep" ADD CONSTRAINT "WorkflowInstanceStep_instanceId_declarationPk_fkey" FOREIGN KEY ("instanceId", "declarationPk") REFERENCES "WorkflowInstance"("id", "declarationPk") ON DELETE CASCADE ON UPDATE CASCADE;
