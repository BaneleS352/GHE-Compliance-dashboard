import { describe, it, expect, beforeEach } from "vitest";
import {
  addDeclaration, updateDeclaration, getDeclarationById,
  addUser, updateUser, deleteUser, getUsers, getUserById,
  getWorkflowForDeclaration, setWorkflowForDeclaration,
  getPendingWorkflowStepsForUser, canUserApprove,
  getCurrentStep, getNextApprover, determineWorkflowSteps,
  getConfig, saveConfig, invalidateCache,
} from "../data/db";
import { authenticate, hashPassword } from "../app/auth/authService";
import { fetchDashboardStats, createDeclaration } from "../services/api";
import type { Declaration, User, WorkflowStep } from "../types/declaration";

function makeDecl(overrides: Partial<Declaration> = {}): Declaration {
  return {
    id: "INT-TEST-" + Date.now(),
    employee: "Integration Tester",
    employeeId: "user-7",
    department: "IT",
    type: "Gift",
    Counterparty: "Test Corp",
    value: 500,
    submitted: "2025-01-01",
    approver: "user-4",
    status: "Pending",
    priority: "Low",
    description: "Integration test declaration",
    relationship: "Client",
    teamMemberNumber: "TM-INT",
    lineManager: "user-3",
    position: "Tester",
    receivedGiven: "Received",
    from: "Supplier",
    contactPerson: "Contact",
    biddingProcess: "No",
    occasion: "Test",
    date: "2025-01-01",
    instances: "1",
    publicOfficial: "No",
    ...overrides,
  };
}

function advanceStep(instance: { declarationId: string; steps: WorkflowStep[] }, stepIdx: number, decision: string, notes = "") {
  const step = instance.steps[stepIdx];
  step.status = decision === "decline" ? "declined" : "approved";
  step.decision = decision as any;
  step.notes = notes || (decision === "decline" ? "Declined" : "Approved");
  step.decidedAt = new Date().toISOString();
  setWorkflowForDeclaration(instance);
}

describe("Integration — full declaration lifecycle", () => {
  beforeEach(() => invalidateCache());

  it("low-value declaration: LM approves → status Approved", () => {
    const cfg = getConfig();
    const id = "INT-LOW-" + Date.now();
    const decl = makeDecl({ id, value: 100, priority: "Low" });
    addDeclaration(decl);
    expect(getDeclarationById(id)?.status).toBe("Pending");

    const rule = determineWorkflowSteps(decl);
    expect(rule).toBe("rule-1");

    const instance = {
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
      ],
    };
    setWorkflowForDeclaration(instance);
    expect(getPendingWorkflowStepsForUser("user-3").length).toBeGreaterThan(0);
    expect(canUserApprove(id, "user-3")).toBe(true);

    advanceStep(instance, 0, "accept");
    updateDeclaration(id, { status: "Approved" });
    expect(getDeclarationById(id)?.status).toBe("Approved");
    expect(getCurrentStep(id)).toBeUndefined();
    expect(getNextApprover(id)).toBeUndefined();
  });

  it("medium-value declaration: LM approves → HR approves → status Approved", () => {
    const id = "INT-MED-" + Date.now();
    const decl = makeDecl({ id, value: 500, priority: "Low" });
    addDeclaration(decl);
    expect(determineWorkflowSteps(decl)).toBe("rule-2");

    const instance = {
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
        { order: 2, role: "hr" as const, assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
      ],
    };
    setWorkflowForDeclaration(instance);

    expect(canUserApprove(id, "user-3")).toBe(true);
    expect(canUserApprove(id, "user-4")).toBe(true);
    expect(getCurrentStep(id)?.role).toBe("lineManager");
    expect(getNextApprover(id)?.role).toBe("lineManager");

    advanceStep(instance, 0, "accept", "LM approved");
    expect(canUserApprove(id, "user-3")).toBe(false);
    expect(canUserApprove(id, "user-4")).toBe(true);
    expect(getCurrentStep(id)?.role).toBe("hr");
    expect(getNextApprover(id)?.role).toBe("hr");

    advanceStep(instance, 1, "org", "HR approved");
    expect(canUserApprove(id, "user-4")).toBe(false);
    updateDeclaration(id, { status: "Approved" });
    expect(getDeclarationById(id)?.status).toBe("Approved");
    expect(getCurrentStep(id)).toBeUndefined();
  });

  it("high-value declaration: LM → HR → CEO all approve → status Approved", () => {
    const id = "INT-HIGH-" + Date.now();
    const decl = makeDecl({ id, value: 5000, priority: "High" });
    addDeclaration(decl);
    expect(determineWorkflowSteps(decl)).toBe("rule-3");

    const instance = {
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
        { order: 2, role: "hr" as const, assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
        { order: 3, role: "ceo" as const, assignee: "user-5", assigneeName: "Sandile Shabalala", label: "CEO Approval", status: "pending" as const, decision: null, notes: "", decidedAt: null },
      ],
    };
    setWorkflowForDeclaration(instance);

    advanceStep(instance, 0, "accept", "LM ok");
    expect(canUserApprove(id, "user-4")).toBe(true);
    expect(canUserApprove(id, "user-5")).toBe(true);

    advanceStep(instance, 1, "org", "HR ok");
    expect(canUserApprove(id, "user-5")).toBe(true);
    expect(getCurrentStep(id)?.role).toBe("ceo");

    advanceStep(instance, 2, "accept", "CEO approved");
    expect(canUserApprove(id, "user-5")).toBe(false);
    updateDeclaration(id, { status: "Approved" });
    expect(getDeclarationById(id)?.status).toBe("Approved");
  });

  it("medium-value declaration: LM approves → HR declines → status Declined", () => {
    const id = "INT-DECLINE-" + Date.now();
    const decl = makeDecl({ id, value: 500 });
    addDeclaration(decl);

    const instance = {
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
        { order: 2, role: "hr" as const, assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
      ],
    };
    setWorkflowForDeclaration(instance);
    advanceStep(instance, 0, "accept", "LM approved");

    advanceStep(instance, 1, "decline", "HR declined - policy violation");
    updateDeclaration(id, { status: "Declined" });
    expect(getDeclarationById(id)?.status).toBe("Declined");
    const wf = getWorkflowForDeclaration(id);
    expect(wf?.steps[1].status).toBe("declined");
    expect(getCurrentStep(id)).toBeUndefined();
  });

  it("declaration with Info Requested status can be updated", () => {
    const id = "INT-INFO-" + Date.now();
    const decl = makeDecl({ id, value: 100 });
    addDeclaration(decl);

    updateDeclaration(id, { status: "Info Requested" });
    expect(getDeclarationById(id)?.status).toBe("Info Requested");

    const instance = {
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "returned" as const, decision: "return" as const, notes: "Need more info", decidedAt: new Date().toISOString() },
      ],
    };
    setWorkflowForDeclaration(instance);
    const next = getNextApprover(id);
    expect(next).toBeUndefined();
  });
});

describe("Integration — admin CRUD", () => {
  beforeEach(() => invalidateCache());

  it("adds, updates, and deletes a user", () => {
    const before = getUsers().length;
    const u: User = {
      id: "int-user-" + Date.now(),
      name: "Int User",
      email: "intuser@test.com",
      passwordHash: hashPassword("test123"),
      role: "teamMember",
      teamMemberNumber: "TM-INT-01",
      department: "Finance",
      position: "Analyst",
      lineManager: "user-3",
    };
    addUser(u);
    expect(getUsers().length).toBe(before + 1);
    expect(getUserById(u.id)?.name).toBe("Int User");

    updateUser(u.id, { position: "Senior Analyst", name: "Int User Updated" });
    expect(getUserById(u.id)?.position).toBe("Senior Analyst");
    expect(getUserById(u.id)?.name).toBe("Int User Updated");

    deleteUser(u.id);
    expect(getUserById(u.id)).toBeUndefined();
    expect(getUsers().length).toBe(before);
  });

  it("rejects adding a user with duplicate email", () => {
    const u: User = {
      id: "dup-email-user",
      name: "Dup Email",
      email: "admin@hb.co.za",
      passwordHash: "",
      role: "teamMember",
      teamMemberNumber: "TM-DUP",
      department: "IT",
      position: "Dev",
      lineManager: "user-3",
    };
    expect(() => addUser(u)).toThrow("already exists");
  });

  it("rejects adding a user with duplicate id", () => {
    const u: User = {
      id: "user-1",
      name: "Dup ID",
      email: "dup-id@test.com",
      passwordHash: "",
      role: "teamMember",
      teamMemberNumber: "TM-DUPID",
      department: "IT",
      position: "Dev",
      lineManager: "user-3",
    };
    expect(() => addUser(u)).toThrow("already exists");
  });

  it("rejects deleting the last admin", () => {
    expect(() => deleteUser("user-6")).toThrow("Cannot delete the last admin user.");
  });

  it("deleting a user with pending declaration steps is blocked", () => {
    const u: User = {
      id: "int-orphan-" + Date.now(),
      name: "Orphan User",
      email: "orphan-int@test.com",
      passwordHash: "",
      role: "teamMember",
      teamMemberNumber: "TM-ORPH",
      department: "IT",
      position: "Dev",
      lineManager: "user-3",
    };
    addUser(u);
    const id = "INT-ORPHAN-DECL";
    const decl = makeDecl({ id, employeeId: u.id });
    addDeclaration(decl);
    setWorkflowForDeclaration({
      declarationId: id,
      steps: [
        { order: 1, role: "lineManager" as const, assignee: "user-3", assigneeName: "Sipho Nkosi", label: "LM Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
      ],
    });

    expect(() => deleteUser(u.id)).toThrow("pending approval steps");
  });
});

describe("Integration — config changes affect workflow determination", () => {
  beforeEach(() => invalidateCache());

  it("changing highValueThreshold changes which workflow rule applies", () => {
    const cfg = getConfig();
    const original = cfg.highValueThreshold;

    saveConfig({ ...cfg, highValueThreshold: 1000 });
    expect(determineWorkflowSteps(makeDecl({ value: 1500 }))).toBe("rule-3");
    expect(determineWorkflowSteps(makeDecl({ value: 500 }))).toBe("rule-2");

    saveConfig({ ...cfg, highValueThreshold: original });
    expect(determineWorkflowSteps(makeDecl({ value: 1500 }))).toBe("rule-2");
  });

  it("changing mediumValueThreshold changes workflow rule", () => {
    const cfg = getConfig();
    const origMedium = cfg.mediumValueThreshold;

    saveConfig({ ...cfg, mediumValueThreshold: 500 });
    expect(determineWorkflowSteps(makeDecl({ value: 400 }))).toBe("rule-1");
    expect(determineWorkflowSteps(makeDecl({ value: 600 }))).toBe("rule-2");

    saveConfig({ ...cfg, mediumValueThreshold: origMedium });
  });

  it("setting threshold to 0 routes all to rule-3 (high value)", () => {
    const cfg = getConfig();
    const origHigh = cfg.highValueThreshold;
    const origMedium = cfg.mediumValueThreshold;

    saveConfig({ ...cfg, highValueThreshold: 0, mediumValueThreshold: 0 });
    expect(determineWorkflowSteps(makeDecl({ value: 1 }))).toBe("rule-3");
    expect(determineWorkflowSteps(makeDecl({ value: 100000 }))).toBe("rule-3");

    saveConfig({ ...cfg, highValueThreshold: origHigh, mediumValueThreshold: origMedium });
  });
});

describe("Integration — auth + screen access", () => {
  beforeEach(() => invalidateCache());

  it("authenticates admin and grants admin screen access", async () => {
    const user = await authenticate("admin@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });

  it("authenticates approver and grants approver screen access", async () => {
    const user = await authenticate("sipho@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("approver");
  });

  it("authenticates team member and grants basic screen access", async () => {
    const user = await authenticate("nomvula@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("teamMember");
  });

  it("correctly seeds passwordHash on first login", async () => {
    invalidateCache();
    const user = await authenticate("pieter@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.passwordHash).toBeTruthy();
    expect(user!.passwordHash.startsWith("$2")).toBe(true);
  });
});

describe("Integration — fetchDashboardStats", () => {
  beforeEach(() => invalidateCache());

  it("returns KPIs that match the seed data", async () => {
    const stats = await fetchDashboardStats();
    expect(stats.kpis.total).toBeGreaterThan(0);
    expect(stats.kpis.pending).toBeGreaterThan(0);
    expect(stats.kpis.approved).toBeGreaterThan(0);
    expect(stats.kpis.totalValue).toBeGreaterThan(0);
    expect(typeof stats.kpis.total).toBe("number");
    expect(stats.complianceTrend.length).toBeGreaterThan(0);
    expect(stats.typeBreakdown.length).toBeGreaterThan(0);
  });

  it("KPIs update after adding a declaration", async () => {
    const before = await fetchDashboardStats();
    const decl = makeDecl({ id: "INT-STATS-" + Date.now(), value: 9999 });
    await createDeclaration(decl);
    const after = await fetchDashboardStats();
    expect(after.kpis.total).toBe(before.kpis.total + 1);
    expect(after.kpis.pending).toBe(before.kpis.pending + 1);
    expect(after.kpis.totalValue).toBeGreaterThan(before.kpis.totalValue);
  });
});
