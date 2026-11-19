-- Support joins and parent deletes for the optional user who decided a step.
CREATE INDEX IF NOT EXISTS "WorkflowInstanceStep_decidedById_idx"
  ON "WorkflowInstanceStep"("decidedById");
