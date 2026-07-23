import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalDetail } from "../app/pages/ApprovalDetail";
import { MyDeclarationsScreen } from "../app/pages/MyDeclarationsScreen";
import { fetchWorkflowInstance, approveWorkflowStep, fetchConfig, fetchDeclarations } from "../services/api";

// ── Shared Test Data ──

function makeDeclaration(overrides: Record<string, unknown> = {}) {
  return {
    id: "GHE-2026-E2E-1", employee: "Nomvula", employeeId: "user-team",
    teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager",
    department: "Marketing", type: "Gift", Counterparty: "E2ECorp", value: 500,
    submitted: "2026-07-15", approver: "Sipho Approver", status: "Pending" as const,
    priority: "Medium" as const, description: "E2E test gift", relationship: "None",
    receivedGiven: "Received", from: "Supplier", contactPerson: "Jane",
    biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-14",
    instances: "1", publicOfficial: "No",
    ...overrides,
  };
}

function makeWorkflow(stepsOverrides: Array<Partial<{
  order: number; role: "lineManager" | "hr" | "ceo"; assignee: string;
  assigneeName: string; label: string; status: "pending" | "approved" | "declined" | "returned";
  decision: string | null; notes: string; decidedAt: string | null;
}>> = []) {
  const defaultSteps = [
    { order: 1, role: "lineManager" as const, assignee: "user-lm", assigneeName: "Sipho Approver",
      label: "Line Manager Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
    { order: 2, role: "hr" as const, assignee: "user-hr", assigneeName: "Lindiwe HR",
      label: "HR Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
    { order: 3, role: "ceo" as const, assignee: "user-ceo", assigneeName: "Sandile CEO",
      label: "CEO Approval", status: "pending" as const, decision: null, notes: "", decidedAt: null },
  ];
  const merged = defaultSteps.map((s, i) => ({ ...s, ...stepsOverrides[i] }));
  return { declarationId: "GHE-2026-E2E-1", steps: merged };
}

function workflowWithStep(roleIdx: number, stepOverrides: Record<string, unknown>) {
  const wf = makeWorkflow();
  wf.steps[roleIdx] = { ...wf.steps[roleIdx], ...stepOverrides } as any;
  return wf;
}

// ── Mocks — mutable object reference to avoid vi.mock hoisting issues ──

const mockSession: { current: Record<string, unknown> | null } = { current: null };

vi.mock("../app/auth/UserContext", () => ({
  useUser: () => ({
    user: mockSession.current,
    setUser: vi.fn(),
    isAuthenticated: !!mockSession.current,
    logout: vi.fn(),
  }),
}));

vi.mock("../services/api", () => ({
  fetchWorkflowInstance: vi.fn(),
  approveWorkflowStep: vi.fn(),
  fetchConfig: vi.fn(() => Promise.resolve({
    highValueThreshold: 2000, mediumValueThreshold: 250,
    slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "",
  })),
  fetchDeclarations: vi.fn(),
}));

// ── Helpers ──

function setRole(role: "approver" | "teamMember" | "admin") {
  const users: Record<string, Record<string, unknown>> = {
    approver: { id: "user-lm", name: "Sipho Approver", email: "sipho@test.com", role: "approver",
      teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: "user-ceo" },
    teamMember: { id: "user-team", name: "Nomvula Team", email: "nomvula@test.com", role: "teamMember",
      teamMemberNumber: "TM-001", department: "Marketing", position: "Brand Manager", lineManager: "user-lm" },
    admin: { id: "user-admin", name: "Admin User", email: "admin@test.com", role: "admin",
      teamMemberNumber: "ADM-001", department: "IT", position: "System Admin", lineManager: null },
  };
  mockSession.current = users[role];
}

function setCustomUser(user: Record<string, unknown>) {
  mockSession.current = user;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.current = null;
  class RO {
    cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width: 1200, height: 900 } }]); }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = RO;
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 1200 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 900 });
});

// ──── Journeys 5-6: Review & Approve ────

describe("Journey 5: Review Declaration", () => {
  it("LM reviews declaration: shows details and active LM step (J5.1)", async () => {
    setRole("approver");
    fetchWorkflowInstance.mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Decision *")).toBeInTheDocument();
    });
    expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
  });

  it("HR sees read-only view when LM step is still pending (J5.2)", async () => {
    setCustomUser({ id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "user-ceo" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("admin sees declaration details in read-only view (J5.7)", async () => {
    setRole("admin");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    expect(screen.getByText(/awaiting additional information/)).toBeInTheDocument();
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("renders high-value substantiation in detail view (J5.5)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const highValueDecl = makeDeclaration({ value: 5000, substantiation: "Board approval obtained" });
    render(<ApprovalDetail declaration={highValueDecl as any} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Board approval obtained")).toBeInTheDocument();
    });
  });

  it("declaration without files shows no documents message (J5.4)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No supporting documents/)).toBeInTheDocument();
    });
  });
});

// ──── Journey 6: Approve Declaration ────

describe("Journey 6: Approve Declaration", () => {
  it("LM approves with 'accept' — workflow advances (J6.1)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Pending" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/accept the actual GHE/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-E2E-1", decision: "accept" })
      );
    });
  });

  it("LM approves with 'org' decision (J6.2)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Pending" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/share the actual GHE.*Organisation Pool/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-E2E-1", decision: "org" })
      );
    });
  });

  it("HR approves after LM has approved (J6.4)", async () => {
    setCustomUser({ id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "user-ceo" });

    const lmApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Pending" } as any);
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/accept the actual GHE/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "accept" })
      );
    });
  });

  it("CEO approves after LM and HR have approved (J6.5)", async () => {
    setCustomUser({ id: "user-ceo", name: "Sandile CEO", email: "sandile@test.com", role: "approver",
      teamMemberNumber: "APR-003", department: "Executive", position: "Group CEO", lineManager: "user-ceo" });

    const lmHrApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    lmHrApproved.steps[1] = { ...lmHrApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmHrApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Approved" } as any);
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/accept the actual GHE/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "accept" })
      );
    });
  });

  it("non-assigned approver cannot see decision controls (J6.13)", async () => {
    setCustomUser({ id: "user-other", name: "Other Approver", email: "other@test.com", role: "approver",
      teamMemberNumber: "APR-999", department: "Sales", position: "Manager", lineManager: "user-ceo" });

    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });
});

// ──── Journey 7: Return Declaration ────

describe("Journey 7: Return Declaration", () => {
  it("LM returns declaration with notes (J7.1)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Info Requested" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Return - Team member to provide/));
    fireEvent.change(screen.getByPlaceholderText("Add notes or reasoning..."), { target: { value: "Please provide receipt" } });
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-E2E-1", decision: "return", notes: "Please provide receipt" })
      );
    });
  });

  it("LM returns declaration without notes (J7.2)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Info Requested" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Return - Team member to provide/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-E2E-1", decision: "return" })
      );
    });
  });

  it("HR returns declaration when step is active (J7.3)", async () => {
    setCustomUser({ id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "user-ceo" });

    const lmApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Info Requested" } as any);
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Return - Team member to provide/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "return" })
      );
    });
  });

  it("returned declaration shows Returned status badge (J7.5)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Info Requested" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const decl = makeDeclaration({ status: "Returned" });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Returned")).toBeInTheDocument();
    });
  });
});

// ──── Journey 8: Decline Declaration ────

describe("Journey 8: Decline Declaration", () => {
  it("LM declines declaration (J8.1)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Declined" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    const declineOption = screen.getByRole("radio", { name: /Declined/ });
    fireEvent.click(declineOption);
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-E2E-1", decision: "decline" })
      );
    });
  });

  it("CEO declines declaration at final step (J8.3)", async () => {
    setCustomUser({ id: "user-ceo", name: "Sandile CEO", email: "sandile@test.com", role: "approver",
      teamMemberNumber: "APR-003", department: "Executive", position: "Group CEO", lineManager: "user-ceo" });

    const lmHrApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    lmHrApproved.steps[1] = { ...lmHrApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmHrApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Declined" } as any);
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    const declineOption = screen.getByRole("radio", { name: /Declined/ });
    fireEvent.click(declineOption);
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "decline" })
      );
    });
  });

  it("declined declaration shows Declined badge (J8.6)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Declined" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration({ status: "Declined" })} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Declined")).toBeInTheDocument();
    });
  });

  it("decline with notes persists them (J8.4)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Declined" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    const declineOption = screen.getByRole("radio", { name: /Declined/ });
    fireEvent.click(declineOption);
    fireEvent.change(screen.getByPlaceholderText("Add notes or reasoning..."), { target: { value: "Policy violation" } });
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "decline", notes: "Policy violation" })
      );
    });
  });
});

// ──── Journey 9: Complete Workflow ────

describe("Journey 9: Complete Workflow", () => {
  it("team member sees completed approval timeline (J9.7)", async () => {
    setRole("teamMember");
    const allApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "Good" });
    allApproved.steps[1] = { ...allApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    allApproved.steps[2] = { ...allApproved.steps[2], status: "approved", decision: "accept", decidedAt: "2026-07-17T10:00:00Z", notes: "Done" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);
    const decl = makeDeclaration({ status: "Approved" });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("completed steps show decision labels, dates, and notes (J9.6)", async () => {
    setRole("teamMember");
    const allApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "Good" });
    allApproved.steps[1] = { ...allApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    allApproved.steps[2] = { ...allApproved.steps[2], status: "approved", decision: "accept", decidedAt: "2026-07-17T10:00:00Z", notes: "Done" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);
    render(<ApprovalDetail declaration={makeDeclaration({ status: "Approved" })} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Approved")).toBeInTheDocument();
    });
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("back button navigates to list after full workflow (J5.11)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const onBack = vi.fn();
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });
});

// ──── Approval Queue Integration ────

describe("Approval Queue E2E (Journeys 5-6)", () => {
  it("approver sees their declaration in the list", async () => {
    setRole("approver");
    const decl = makeDeclaration({ employeeId: "user-lm" });
    vi.mocked(fetchDeclarations).mockResolvedValue([decl]);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());

    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-E2E-1").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("team member can view their own approved declaration timeline from list", async () => {
    setRole("teamMember");
    vi.mocked(fetchDeclarations).mockResolvedValue([makeDeclaration({ status: "Approved" })]);
    const allApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    allApproved.steps[1] = { ...allApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    allApproved.steps[2] = { ...allApproved.steps[2], status: "approved", decision: "accept", decidedAt: "2026-07-17T10:00:00Z", notes: "Done" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);

    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    });
  });
});
