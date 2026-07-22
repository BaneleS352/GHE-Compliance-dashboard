import { describe, it, expect, vi, beforeEach } from "vitest";
import { setToken, clearToken } from "../services/httpClient";
import {
  fetchDeclarations, fetchDeclarationById, createDeclaration,
  updateDeclaration, updateDeclarationStatus, submitDeclaration,
  fetchDashboardStats, fetchUsers, fetchUserById,
  createUser, updateUser, deleteUser,
  fetchConfig, saveConfig,
  fetchDropdowns, updateDropdowns,
  fetchAdminDashboard,
  fetchWorkflowRules, createWorkflowRule, updateWorkflowRule, deleteWorkflowRule,
  fetchPendingWorkflows, fetchWorkflowInstance, approveWorkflowStep,
  fetchReportStatusBreakdown, fetchReportSLA,
  fetchReportCounterpartyConcentration, fetchReportHighValue,
  fetchReportList, fetchApprovalOptions,
  createApprovalOption, updateApprovalOption, deleteApprovalOption,
} from "../services/api";
import { Declaration } from "../types/declaration";

beforeEach(() => {
  clearToken();
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": "application/json" }),
    json: () => Promise.resolve(body),
  } as Response);
}

function mockDeclaration(id = "GHE-2026-1000"): Declaration {
  return {
    id, employee: "Test User", employeeId: "user-1", department: "IT",
    type: "Gift", Counterparty: "TestCorp", value: 500, submitted: "2026-07-01",
    approver: "Sipho Nkosi", status: "Draft", priority: "Medium",
    description: "Test", relationship: "Yes", teamMemberNumber: "TM-001",
    lineManager: "Sipho Nkosi", position: "Dev", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Jane", biddingProcess: "No",
    occasion: "Business Meeting", date: "2026-07-01", instances: "1",
    publicOfficial: "No",
  };
}

describe("fetchDeclarations", () => {
  it("returns mapped declarations on 200", async () => {
    mockFetch(200, [{ id: "GHE-1", employee: "A", counterparty: "B", value: 100, submitted: "2026-01-01", approver: "X", status: "Draft", priority: "Low" }]);
    const result = await fetchDeclarations();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("GHE-1");
  });

  it("passes status and search query params", async () => {
    const spy = mockFetch(200, []);
    await fetchDeclarations("Pending", "GHE");
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("status=Pending");
    expect(url).toContain("search=GHE");
  });

  it("throws on 500", async () => {
    mockFetch(500, { error: "Server error" });
    await expect(fetchDeclarations()).rejects.toThrow("Server error");
  });
});

describe("fetchDeclarationById", () => {
  it("returns declaration with workflowSteps", async () => {
    const body = { id: "GHE-1", employee: "A", workflowSteps: [{ role: "lineManager", status: "pending" }] };
    mockFetch(200, body);
    const result = await fetchDeclarationById("GHE-1");
    expect(result.id).toBe("GHE-1");
  });
});

describe("createDeclaration", () => {
  it("POSTs declaration and returns mapped result", async () => {
    const decl = mockDeclaration();
    mockFetch(201, { id: "GHE-2026-1000", ...decl, status: "Draft" });
    const result = await createDeclaration(decl);
    expect(result.id).toBe("GHE-2026-1000");
    expect(result.status).toBe("Draft");
  });

  it("strips undefined fields from request body", async () => {
    const spy = mockFetch(201, { id: "GHE-1" });
    const decl = mockDeclaration();
    delete (decl as any).files;
    await createDeclaration(decl);
    const sent = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(sent.files).toBeUndefined();
  });
});

describe("updateDeclaration", () => {
  it("PUTs declaration and returns mapped result", async () => {
    mockFetch(200, { id: "GHE-1", description: "Updated" });
    const result = await updateDeclaration("GHE-1", { description: "Updated" });
    expect(result.description).toBe("Updated");
  });
});

describe("updateDeclarationStatus", () => {
  it("PATCHes status and returns declaration", async () => {
    mockFetch(200, { id: "GHE-1", status: "Approved" });
    const result = await updateDeclarationStatus("GHE-1", "Approved");
    expect(result.status).toBe("Approved");
  });
});

describe("submitDeclaration", () => {
  it("PATCHes submit and returns result", async () => {
    mockFetch(200, { id: "GHE-1", status: "Pending", approver: "Sipho Nkosi" });
    const result = await submitDeclaration("GHE-1");
    expect(result.status).toBe("Pending");
  });
});

describe("fetchDashboardStats", () => {
  it("returns stats on 200", async () => {
    const stats = { kpis: { total: 10, pending: 3 }, complianceTrend: [], typeBreakdown: [] };
    mockFetch(200, stats);
    const result = await fetchDashboardStats();
    expect(result.kpis.total).toBe(10);
  });
});

describe("fetchUsers", () => {
  it("passes search and role params", async () => {
    const spy = mockFetch(200, []);
    await fetchUsers("Sipho", "approver");
    const url = spy.mock.calls[0][0] as string;
    expect(url).toContain("search=Sipho");
    expect(url).toContain("role=approver");
  });
});

describe("fetchUserById", () => {
  it("GETs user by ID", async () => {
    mockFetch(200, { id: "user-1", name: "Sipho" });
    const result = await fetchUserById("user-1");
    expect(result.name).toBe("Sipho");
  });
});

describe("createUser", () => {
  it("POSTs and returns new user", async () => {
    mockFetch(201, { id: "user-new", name: "New User" });
    const result = await createUser({ name: "New User", email: "new@test.com", role: "teamMember" });
    expect(result.id).toBe("user-new");
  });
});

describe("updateUser", () => {
  it("PUTs and returns updated user", async () => {
    mockFetch(200, { id: "user-1", name: "Updated" });
    const result = await updateUser("user-1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });
});

describe("deleteUser", () => {
  it("DELETEs and returns result", async () => {
    mockFetch(200, { message: "Deleted" });
    const result = await deleteUser("user-1");
    expect(result.message).toBe("Deleted");
  });
});

describe("fetchConfig", () => {
  it("returns config", async () => {
    mockFetch(200, { highValueThreshold: 2000 });
    const result = await fetchConfig();
    expect(result.highValueThreshold).toBe(2000);
  });
});

describe("saveConfig", () => {
  it("PUTs config", async () => {
    mockFetch(200, { highValueThreshold: 5000 });
    const result = await saveConfig({ highValueThreshold: 5000 });
    expect(result.highValueThreshold).toBe(5000);
  });
});

describe("fetchDropdowns / updateDropdowns", () => {
  it("fetchDropdowns returns dropdowns", async () => {
    mockFetch(200, { departments: ["IT", "HR"] });
    const result = await fetchDropdowns();
    expect(result.departments).toEqual(["IT", "HR"]);
  });

  it("updateDropdowns PUTs dropdowns", async () => {
    mockFetch(200, { departments: ["IT"] });
    const result = await updateDropdowns({ departments: ["IT"] });
    expect(result.departments).toEqual(["IT"]);
  });
});

describe("fetchAdminDashboard", () => {
  it("returns dashboard data", async () => {
    mockFetch(200, { users: 5, declarations: 20 });
    const result = await fetchAdminDashboard();
    expect(result.users).toBe(5);
  });
});

describe("workflow rules CRUD", () => {
  it("fetchWorkflowRules returns rules", async () => {
    mockFetch(200, [{ id: "rule-1", name: "Low Value" }]);
    const result = await fetchWorkflowRules();
    expect(result).toHaveLength(1);
  });

  it("createWorkflowRule POSTs", async () => {
    mockFetch(201, { id: "rule-new", name: "New Rule" });
    const result = await createWorkflowRule({ name: "New Rule", steps: "[]" });
    expect(result.id).toBe("rule-new");
  });

  it("updateWorkflowRule PUTs", async () => {
    mockFetch(200, { id: "rule-1", name: "Updated" });
    const result = await updateWorkflowRule("rule-1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("deleteWorkflowRule DELETEs", async () => {
    mockFetch(200, { message: "Deleted" });
    const result = await deleteWorkflowRule("rule-1");
    expect(result.message).toBe("Deleted");
  });
});

describe("workflow operations", () => {
  it("fetchPendingWorkflows returns mapped pending declarations", async () => {
    mockFetch(200, [{
      declaration: {
        id: "GHE-1",
        employee: "A",
        employeeId: "user-1",
        teamMemberNumber: "TM-1",
        lineManager: "Sipho",
        position: "Manager",
        department: "IT",
        company: "HB",
        team: "Ops",
        type: "Gift",
        counterparty: "B",
        value: 100,
        submitted: "2026-01-01",
        approver: "Sipho",
        status: "Pending",
        priority: "Low",
        description: "Test",
        relationship: "Yes",
        receivedGiven: "Received",
        from: "Supplier",
        contactPerson: "Jane",
        biddingProcess: "No",
        contractNegotiation: "No",
        occasion: "Business Meeting",
        date: "2026-01-01",
        instances: "1",
        publicOfficial: "No",
        files: [],
      },
      step: { role: "lineManager", status: "pending" },
    }]);
    const result = await fetchPendingWorkflows();
    expect(result).toHaveLength(1);
    expect(result[0].declaration.Counterparty).toBe("B");
    expect(result[0].declaration.contactPerson).toBe("Jane");
  });

  it("fetchWorkflowInstance returns instance", async () => {
    mockFetch(200, { declarationId: "GHE-1", steps: [] });
    const result = await fetchWorkflowInstance("GHE-1");
    expect(result.declarationId).toBe("GHE-1");
  });

  it("approveWorkflowStep POSTs decision", async () => {
    mockFetch(200, { status: "Approved" });
    const result = await approveWorkflowStep({ declarationId: "GHE-1", decision: "accept" });
    expect(result.status).toBe("Approved");
  });

  it("approveWorkflowStep sends notes when provided", async () => {
    const spy = mockFetch(200, { status: "Approved" });
    await approveWorkflowStep({ declarationId: "GHE-1", decision: "accept", notes: "Looks good" });
    const sent = JSON.parse((spy.mock.calls[0][1] as any).body as string);
    expect(sent.notes).toBe("Looks good");
  });
});

describe("report endpoints", () => {
  it("fetchReportStatusBreakdown returns breakdown", async () => {
    mockFetch(200, { Draft: 5, Pending: 3 });
    const result = await fetchReportStatusBreakdown();
    expect(result.Draft).toBe(5);
  });

  it("fetchReportSLA returns SLA data", async () => {
    mockFetch(200, [{ role: "hr", avgDays: 2 }]);
    const result = await fetchReportSLA();
    expect(result).toHaveLength(1);
  });

  it("fetchReportCounterpartyConcentration returns data", async () => {
    mockFetch(200, [{ name: "CorpX", count: 10 }]);
    const result = await fetchReportCounterpartyConcentration();
    expect(result).toHaveLength(1);
  });

  it("fetchReportHighValue returns data", async () => {
    mockFetch(200, [{ id: "GHE-1", value: 5000 }]);
    const result = await fetchReportHighValue();
    expect(result).toHaveLength(1);
  });

  it("fetchReportList returns list", async () => {
    mockFetch(200, [{ id: "GHE-1" }]);
    const result = await fetchReportList();
    expect(result).toHaveLength(1);
  });

  it("fetchApprovalOptions returns options", async () => {
    mockFetch(200, [{ value: "accept", label: "Accept" }]);
    const result = await fetchApprovalOptions();
    expect(result).toHaveLength(1);
  });

  it("createApprovalOption POSTs new option", async () => {
    mockFetch(201, { value: "new-opt", label: "New Option" });
    const result = await createApprovalOption({ id: "new-opt", value: "new-opt", label: "New Option" });
    expect(result.value).toBe("new-opt");
  });

  it("updateApprovalOption PUTs updated option", async () => {
    mockFetch(200, { value: "updated", label: "Updated" });
    const result = await updateApprovalOption("accept", { value: "updated", label: "Updated" });
    expect(result.label).toBe("Updated");
  });

  it("deleteApprovalOption DELETEs option", async () => {
    mockFetch(200, { message: "Deleted" });
    const result = await deleteApprovalOption("accept");
    expect(result.message).toBe("Deleted");
  });
});

describe("error handling", () => {
  it("throws with server error message", async () => {
    mockFetch(403, { error: "Forbidden" });
    await expect(fetchDeclarations()).rejects.toThrow("Forbidden");
  });

  it("throws generic message when no error body", async () => {
    mockFetch(500, null);
    await expect(fetchDeclarations()).rejects.toThrow("Request failed with status 500");
  });

  it("includes auth token when set", async () => {
    setToken("test-token-123");
    const spy = mockFetch(200, []);
    await fetchDeclarations();
    const headers = (spy.mock.calls[0][1] as any).headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-token-123");
  });
});
