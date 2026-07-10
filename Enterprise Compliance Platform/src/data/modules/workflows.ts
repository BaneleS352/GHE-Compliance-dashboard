import { WorkflowRule, WorkflowInstance, WorkflowStep } from "../../types/declaration";
import { get, persist } from "../db";

export function getWorkflowRules() {
  return get().workflowRules;
}

export function addWorkflowRule(rule: WorkflowRule) {
  get().workflowRules.push(rule);
  persist();
}

export function updateWorkflowRule(id: string, updates: Partial<WorkflowRule>) {
  const db = get();
  const idx = db.workflowRules.findIndex((r) => r.id === id);
  if (idx !== -1) {
    const rule = db.workflowRules[idx];
    const updated = { ...rule, ...updates };
    for (const step of updated.steps || []) {
      if (!step.role) {
        throw new Error(`Invalid role in workflow step: ${step.role}`);
      }
      const existing = db.workflowInstances.filter((w) =>
        w.steps.some((s) => s.role === step.role)
      );
      if (existing.length > 0) {
        throw new Error(`Cannot have a "${step.role}" step; still active in ${existing.length} workflow(s).`);
      }
    }
    db.workflowRules[idx] = updated;
    persist();
  } else {
    throw new Error(`Workflow rule with id "${id}" not found.`);
  }
}

export function deleteWorkflowRule(id: string) {
  const db = get();
  db.workflowRules = db.workflowRules.filter((r) => r.id !== id);
  persist();
}

export function getWorkflowForDeclaration(declarationId: string): WorkflowInstance | undefined {
  return get().workflowInstances.find((w) => w.declarationId === declarationId);
}

export function setWorkflowForDeclaration(instance: WorkflowInstance) {
  if (instance.declarationId === "") {
    throw new Error("declarationId must be non-empty");
  }
  const db = get();
  const idx = db.workflowInstances.findIndex((w) => w.declarationId === instance.declarationId);
  if (idx !== -1) {
    db.workflowInstances[idx] = instance;
  } else {
    db.workflowInstances.push(instance);
  }
  persist();
}

export function getPendingWorkflowStepsForUser(userId: string) {
  const db = get();
  const pending: { declaration: any; step: WorkflowInstance["steps"][0] }[] = [];
  for (const inst of db.workflowInstances) {
    const decl = db.declarations.find((d) => d.id === inst.declarationId);
    if (!decl) continue;
    const pendingStep = inst.steps.find((s) => s.status === "pending" && s.assignee === userId);
    if (pendingStep) pending.push({ declaration: decl, step: pendingStep });
  }
  return pending;
}

export function canUserApprove(declarationId: string, userId: string): boolean {
  const instance = getWorkflowForDeclaration(declarationId);
  if (!instance) return false;
  const step = instance.steps.find((s) => s.status === "pending" && s.assignee === userId);
  return !!step;
}

export function getCurrentStep(declarationId: string) {
  const instance = getWorkflowForDeclaration(declarationId);
  if (!instance) return undefined;
  return instance.steps.find((s) => s.status === "pending");
}

export function getNextApprover(declarationId: string) {
  const instance = getWorkflowForDeclaration(declarationId);
  if (!instance) return undefined;
  const next = instance.steps.find((s) => s.status === "pending");
  return next ? { role: next.role, name: next.assigneeName } : undefined;
}