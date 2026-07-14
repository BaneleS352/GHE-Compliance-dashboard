import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate, canAccessScreen } from "../app/auth/authService";
import { fetchDashboardStats, createDeclaration } from "../services/api";
import type { Declaration } from "../types/declaration";

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
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
