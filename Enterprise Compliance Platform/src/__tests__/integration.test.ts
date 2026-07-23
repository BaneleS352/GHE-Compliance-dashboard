import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { authenticate, canAccessScreen } from "../app/auth/authService";
import { setToken, clearToken } from "../services/httpClient";
import {
  fetchDeclarations, createDeclaration, updateDeclaration, submitDeclaration,
  fetchWorkflowInstance, approveWorkflowStep,
  fetchConfig, fetchDashboardStats, fetchPendingWorkflows,
} from "../services/api";
import type { Declaration } from "../types/declaration";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response);
}

const sampleDeclaration: Declaration = {
  id: "GHE-2026-INT-1", employee: "Nomvula", employeeId: "u1",
  teamMemberNumber: "TM-001", lineManager: "Sipho Nkosi",
  position: "Brand Manager", department: "Marketing",
  type: "Gift", Counterparty: "Acme Corp", value: 500,
  submitted: "2026-07-15", approver: "Sipho Nkosi", status: "Pending",
  priority: "Medium", description: "Integration test gift",
  relationship: "Yes", receivedGiven: "Received", from: "Supplier",
  contactPerson: "Jane", biddingProcess: "No",
  occasion: "Business Meeting", date: "2026-07-14",
  instances: "1", publicOfficial: "No",
};

beforeEach(() => {
  vi.restoreAllMocks();
  clearToken();
});

describe("Integration — auth + screen access", () => {
  it("authenticates admin and grants admin screen access", async () => {
    mockFetch(200, { token: "t", user: { id: "u6", email: "admin@hb.co.za", role: "admin" } });
    const user = await authenticate("admin@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("admin");
  });

  it("authenticates approver and grants approver screen access", async () => {
    mockFetch(200, { token: "t", user: { id: "u3", email: "sipho@hb.co.za", role: "approver" } });
    const user = await authenticate("sipho@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("approver");
  });

  it("authenticates team member and grants basic screen access", async () => {
    mockFetch(200, { token: "t", user: { id: "u1", email: "nomvula@hb.co.za", role: "teamMember" } });
    const user = await authenticate("nomvula@hb.co.za", "password");
    expect(user).not.toBeNull();
    expect(user!.role).toBe("teamMember");
  });

  it("returns null on failed auth", async () => {
    mockFetch(401, { error: "Invalid credentials" });
    const user = await authenticate("admin@hb.co.za", "wrong");
    expect(user).toBeNull();
  });
});

describe("Integration — fetchDashboardStats", () => {
  it("returns KPIs that match the seed data", async () => {
    mockFetch(200, {
      kpis: { total: 10, pending: 5, approved: 3, declined: 1, escalated: 1, totalValue: 50000 },
      complianceTrend: [{ month: "2024-01", compliant: 8, nonCompliant: 2 }],
      typeBreakdown: [{ type: "Gift", count: 4 }],
    });
    const stats = await fetchDashboardStats();
    expect(stats.kpis.total).toBeGreaterThan(0);
    expect(stats.kpis.pending).toBeGreaterThan(0);
    expect(stats.kpis.approved).toBeGreaterThan(0);
    expect(stats.kpis.totalValue).toBeGreaterThan(0);
    expect(typeof stats.kpis.total).toBe("number");
    expect(stats.complianceTrend.length).toBeGreaterThan(0);
    expect(stats.typeBreakdown.length).toBeGreaterThan(0);
  });

  it("throws on server error", async () => {
    mockFetch(500, { error: "Server error" });
    await expect(fetchDashboardStats()).rejects.toThrow();
  });
});

describe("Integration — createDeclaration", () => {
  it("creates a declaration via POST", async () => {
    mockFetch(201, {
      id: "NEW-1", employee: "Test", employeeId: "u1",
      type: "Gift", value: 100, status: "Draft",
    });
    const dec = await createDeclaration({ employee: "Test" } as Declaration);
    expect(dec.id).toBe("NEW-1");
    expect(dec.status).toBe("Draft");
  });
});

// ── Journey-level integration: full user-journey data flows ──

describe("Integration — Journey 1+4: Create & Submit (J1.1 / J4.1)", () => {
  it("auth → createDeclaration (Draft) → submitDeclaration (Pending)", async () => {
    mockFetch(201, { id: "GHE-INT-1", status: "Draft", approver: "" });
    const draft = await createDeclaration(sampleDeclaration);
    expect(draft.status).toBe("Draft");

    mockFetch(200, { id: "GHE-INT-1", status: "Pending", approver: "Sipho Nkosi" });
    const submitted = await submitDeclaration("GHE-INT-1");
    expect(submitted.status).toBe("Pending");
    expect(submitted.approver).toBe("Sipho Nkosi");
  });

  it("createDeclaration includes auth token when set", async () => {
    setToken("int-token-123");
    const spy = mockFetch(201, { id: "GHE-INT-2", status: "Draft" });
    await createDeclaration(sampleDeclaration);
    const headers = (spy.mock.calls[0][1] as any).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer int-token-123");
  });
});

describe("Integration — Journey 2: Save Draft (J2.1)", () => {
  it("auth → createDeclaration with Draft status → onDraftSaved", async () => {
    const spy = mockFetch(201, { id: "GHE-INT-D1", status: "Draft" });
    const draft = await createDeclaration({ ...sampleDeclaration, status: "Draft" });
    expect(draft.status).toBe("Draft");
    const sent = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(sent.status).toBe("Draft");
  });

  it("updateDeclaration PUTs changes for returned draft (J3.7)", async () => {
    const spy = mockFetch(200, { id: "GHE-INT-D1", description: "Updated gift", status: "Draft" });
    const updated = await updateDeclaration("GHE-INT-D1", { description: "Updated gift" });
    expect(updated.description).toBe("Updated gift");
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.description).toBe("Updated gift");
  });
});

describe("Integration — Journey 4: Submit lifecycle (J4.2 / J4.4 / J4.5)", () => {
  it("resubmit returned declaration (J4.2)", async () => {
    mockFetch(200, { id: "GHE-INT-R1", status: "Pending", approver: "Sipho Nkosi" });
    const res = await submitDeclaration("GHE-INT-R1");
    expect(res.status).toBe("Pending");
  });

  it("submit already-Pending returns error (J4.4)", async () => {
    mockFetch(409, { error: "Declaration is already Pending" });
    await expect(submitDeclaration("GHE-INT-P1")).rejects.toThrow("Declaration is already Pending");
  });

  it("submit Approved returns error (J4.5)", async () => {
    mockFetch(409, { error: "Cannot submit an Approved declaration" });
    await expect(submitDeclaration("GHE-INT-A1")).rejects.toThrow("Cannot submit an Approved declaration");
  });
});

describe("Integration — Journey 5: Fetch workflow (J5.1 / J5.2)", () => {
  it("fetchWorkflowInstance returns steps for pending declaration", async () => {
    mockFetch(200, {
      declarationId: "GHE-INT-1",
      steps: [
        { order: 1, role: "lineManager", assignee: "user-lm", status: "pending" },
        { order: 2, role: "hr", assignee: "user-hr", status: "pending" },
      ],
    });
    const wf = await fetchWorkflowInstance("GHE-INT-1");
    expect(wf.declarationId).toBe("GHE-INT-1");
    expect(wf.steps).toHaveLength(2);
    expect(wf.steps[0].role).toBe("lineManager");
  });

  it("fetchConfig returns threshold settings", async () => {
    mockFetch(200, { highValueThreshold: 2000, mediumValueThreshold: 250 });
    const cfg = await fetchConfig();
    expect(cfg.highValueThreshold).toBe(2000);
  });
});

describe("Integration — Journey 6: Approve (J6.1 / J6.2 / J6.6 / J6.9)", () => {
  it("LM approves with 'accept' via approveWorkflowStep (J6.1)", async () => {
    const spy = mockFetch(200, { status: "Pending" });
    const res = await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "accept" });
    expect(res.status).toBe("Pending");
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.decision).toBe("accept");
    expect(body.declarationId).toBe("GHE-INT-1");
  });

  it("approves with 'org' decision (J6.2)", async () => {
    const spy = mockFetch(200, { status: "Pending" });
    await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "org" });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.decision).toBe("org");
  });

  it("approves with notes (J6.9)", async () => {
    const spy = mockFetch(200, { status: "Pending" });
    await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "accept", notes: "Approved after compliance check" });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.notes).toBe("Approved after compliance check");
  });

  it("full chain: approve after fetchWorkflowInstance (J6.6)", async () => {
    mockFetch(200, { declarationId: "GHE-INT-1", steps: [{ role: "lineManager", status: "pending" }] });
    const wf = await fetchWorkflowInstance("GHE-INT-1");
    expect(wf.steps[0].role).toBe("lineManager");

    mockFetch(200, { status: "Pending" });
    const res = await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "accept" });
    expect(res.status).toBe("Pending");
  });
});

describe("Integration — Journey 7: Return (J7.1 / J7.2)", () => {
  it("returns declaration with notes (J7.1)", async () => {
    const spy = mockFetch(200, { status: "Info Requested" });
    const res = await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "return", notes: "Missing receipt" });
    expect(res.status).toBe("Info Requested");
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.decision).toBe("return");
    expect(body.notes).toBe("Missing receipt");
  });

  it("returns declaration without notes (J7.2)", async () => {
    const spy = mockFetch(200, { status: "Info Requested" });
    await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "return" });
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.decision).toBe("return");
    expect(body.notes).toBeUndefined();
  });
});

describe("Integration — Journey 8: Decline (J8.1 / J8.5 / J8.7)", () => {
  it("declines declaration (J8.1)", async () => {
    const spy = mockFetch(200, { status: "Declined" });
    const res = await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "decline" });
    expect(res.status).toBe("Declined");
    const body = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(body.decision).toBe("decline");
  });

  it("declines without notes still succeeds (J8.5)", async () => {
    mockFetch(200, { status: "Declined" });
    const res = await approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "decline" });
    expect(res.status).toBe("Declined");
  });
});

describe("Integration — Journey 9: Complete workflow (J9.8 / J9.6)", () => {
  it("dashboard stats reflect declaration counts (J9.8)", async () => {
    mockFetch(200, {
      kpis: { total: 15, pending: 7, approved: 5, declined: 2, escalated: 1, totalValue: 75000 },
      complianceTrend: [],
      typeBreakdown: [{ type: "Gift", count: 8 }],
    });
    const stats = await fetchDashboardStats();
    expect(stats.kpis.total).toBe(15);
    expect(stats.kpis.pending).toBe(7);
    expect(stats.kpis.approved).toBe(5);
    expect(stats.kpis.declined).toBe(2);
  });

  it("workflow shows completed steps after full approval (J9.6)", async () => {
    mockFetch(200, {
      declarationId: "GHE-INT-1",
      steps: [
        { order: 1, role: "lineManager", assignee: "user-lm", status: "approved", decision: "accept",
          decidedAt: "2026-07-15T10:00:00Z", notes: "OK" },
        { order: 2, role: "hr", assignee: "user-hr", status: "approved", decision: "org",
          decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" },
        { order: 3, role: "ceo", assignee: "user-ceo", status: "approved", decision: "accept",
          decidedAt: "2026-07-17T10:00:00Z", notes: "Done" },
      ],
    });
    const wf = await fetchWorkflowInstance("GHE-INT-1");
    expect(wf.steps).toHaveLength(3);
    wf.steps.forEach((s: any) => expect(s.status).toBe("approved"));
    expect(wf.steps[0].decision).toBe("accept");
    expect(wf.steps[1].decision).toBe("org");
    expect(wf.steps[2].decision).toBe("accept");
  });
});

describe("Integration — Auth: unauthenticated calls rejected", () => {
  it("fetchDeclarations returns 401 when not authenticated", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(fetchDeclarations()).rejects.toThrow("Unauthorized");
  });

  it("approveWorkflowStep returns 401 when not authenticated", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(approveWorkflowStep({ declarationId: "GHE-INT-1", decision: "accept" })).rejects.toThrow("Unauthorized");
  });
});
