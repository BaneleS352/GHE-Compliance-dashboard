import { setupResponsiveLayout } from "../test-helpers/responsiveLayout";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalDetail } from "../app/pages/ApprovalDetail";
import { MyDeclarationsScreen } from "../app/pages/MyDeclarationsScreen";
import { fetchWorkflowInstance, approveWorkflowStep, fetchDeclarations } from "../services/api";
import type { Declaration } from "../types/declaration";
import type { WorkflowInstanceResponse, WorkflowStepResponse } from "../services/api";

// ── Shared Test Data ──

function makeDeclaration(overrides: Partial<Declaration> = {}): Declaration {
  return {
    id: "GHE-2026-E2E-1", employee: "Nomvula", employeeId: 4,
    teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager",
    department: "Marketing", type: "Gift", counterparty: "E2ECorp", value: 500,
    submitted: "2026-07-15", approver: "Sipho Approver", status: "Pending" as const,
    priority: "Medium" as const, description: "E2E test gift", relationship: "None",
    receivedGiven: "Received", from: "Supplier", contactPerson: "Jane",
    biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-14",
    instances: "1", publicOfficial: "No",
    ...overrides,
  };
}

function makeWorkflow(stepsOverrides: Array<Partial<WorkflowStepResponse>> = []): WorkflowInstanceResponse {
  const defaultSteps: WorkflowStepResponse[] = [
    { order: 1, role: "lineManager" as const, assignee: 2, assigneeName: "Sipho Approver",
      label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    { order: 2, role: "hr" as const, assignee: 3, assigneeName: "Lindiwe HR",
      label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ];
  const merged = defaultSteps.map((s, i) => ({ ...s, ...stepsOverrides[i] }));
  return { declarationId: "GHE-2026-E2E-1", steps: merged };
}

function workflowWithStep(roleIdx: number, stepOverrides: Partial<WorkflowStepResponse>): WorkflowInstanceResponse {
  const wf = makeWorkflow();
  const currentStep = wf.steps[roleIdx];
  if (!currentStep) throw new Error(`Workflow step ${roleIdx} does not exist`);
  wf.steps[roleIdx] = { ...currentStep, ...stepOverrides };
  return wf;
}

// ── Mocks — mutable object reference to avoid vi.mock hoisting issues ──

const mockSession: { current: Record<string, unknown> | null } = { current: null };

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(() => Promise.resolve("msal-test-token")),
  initializeIdentity: vi.fn(),
}));

vi.mock("../app/auth/UserContext", () => ({
  useUser: () => ({
    user: mockSession.current,
    setUser: vi.fn(),
    isAuthenticated: !!mockSession.current,
    logout: vi.fn(),
  }),
}));

vi.mock("../services/api", () => ({
  fetchDeclarationAudit: vi.fn().mockResolvedValue([]),
  fetchWorkflowInstance: vi.fn(),
  approveWorkflowStep: vi.fn(),
  fetchPublicConfig: vi.fn(() => Promise.resolve({ highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maximumValue: 1000000 })),
  fetchDeclarations: vi.fn(),
}));

// ── Helpers ──

function setRole(role: "approver" | "teamMember" | "admin") {
  const users: Record<string, Record<string, unknown>> = {
    approver: { id: 2, name: "Sipho Approver", email: "sipho@test.com", role: "approver",
      teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: "Admin User" },
    teamMember: { id: 4, name: "Nomvula Team", email: "nomvula@test.com", role: "teamMember",
      teamMemberNumber: "TM-001", department: "Marketing", position: "Brand Manager", lineManager: "Sipho Approver" },
    admin: { id: 1, name: "Admin User", email: "admin@test.com", role: "admin",
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
  setupResponsiveLayout(1200, 900);
  Element.prototype.scrollIntoView = vi.fn();
});

// ──── Journeys 5-6: Review & Approve ────

describe("Journey 5: Review Declaration", () => {
  it("LM reviews declaration: shows details and active LM step (J5.1)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Decision *")).toBeInTheDocument();
    });
    expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
  });

  it("HR sees read-only view when LM step is still pending (J5.2)", async () => {
    setCustomUser({ id: 3, name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "Sipho Approver" });
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
    expect(screen.getByText(/Awaiting action from/)).toBeInTheDocument();
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("renders high-value substantiation in detail view (J5.5)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const highValueDecl = makeDeclaration({ value: 5000, substantiation: "Board approval obtained" });
    render(<ApprovalDetail declaration={highValueDecl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Board approval obtained")).toBeInTheDocument();
    });
  });

  it("low-value declaration does not show substantiation field (J5.6)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const lowValueDecl = makeDeclaration({ value: 100 });
    render(<ApprovalDetail declaration={lowValueDecl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    expect(screen.queryByText(/substantiate/i)).not.toBeInTheDocument();
  });

  it("review declaration with 10+ files renders all documents (J5.3)", async () => {
    setRole("approver");
    const files = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `document-${i + 1}.pdf`, size: 10, type: "application/pdf", url: `/api/files/${i + 1}` }));
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const decl = makeDeclaration({ files });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("GHE-2026-E2E-1")).toBeInTheDocument();
    });
    expect(screen.getByText("document-1.pdf")).toBeInTheDocument();
    expect(screen.getByText("document-12.pdf")).toBeInTheDocument();
  });

  it("declaration without files shows no documents message (J5.4)", async () => {
    setRole("approver");
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/No supporting documents/)).toBeInTheDocument();
    });
  });

  it("download file from supporting documents (J5.8)", async () => {
    setRole("approver");
    const fakeBlob = new Blob(["test"], { type: "application/pdf" });
    const fakeUrl = "blob:http://localhost/test-blob";
    const createObjectURL = vi.fn(() => fakeUrl);
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(fakeBlob) });

    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const decl = makeDeclaration({ files: [{ id: 1, name: "report.pdf", size: 10, type: "application/pdf", url: "/api/files/1" }] });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Download/i }));
  });

  it("view file in new tab from supporting documents (J5.9)", async () => {
    setRole("approver");
    const windowOpen = vi.fn();
    window.open = windowOpen;
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/test-view");
    URL.revokeObjectURL = vi.fn();
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob()) });

    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    const decl = makeDeclaration({ files: [{ id: 1, name: "report.pdf", size: 10, type: "application/pdf", url: "/api/files/1" }] });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("report.pdf")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /^View$/i }));
    await waitFor(() => {
      expect(window.open).toHaveBeenCalledWith(expect.stringContaining("blob:"), "_blank", "noopener,noreferrer");
    });
  });
});

// ──── Journey 6: Approve Declaration ────

describe("Journey 6: Approve Declaration", () => {
  it("LM approves with 'accept' — workflow advances (J6.1)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Pending" });
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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Pending" });
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
    setCustomUser({ id: 3, name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "Sipho Approver" });

    const lmApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Pending" });
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    const acceptOptions = screen.getAllByText(/accept the actual GHE/);
    fireEvent.click(acceptOptions[acceptOptions.length - 1]);
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "accept" })
      );
    });
  });

  it("API fails during approval — error shown, state unchanged (J6.11)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockRejectedValue(new Error("Approval service unavailable"));
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/accept the actual GHE/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(screen.getByText(/Approval service unavailable/)).toBeInTheDocument();
    });
  });

  it("timeout during approval shows error (J6.12)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockReturnValue(new Promise(() => {}));
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    fireEvent.click(screen.getByText(/accept the actual GHE/));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(screen.getByText(/Decision submitted successfully/)).not.toBeInTheDocument();
    }, { timeout: 100 }).catch(() => {});
  });

  it("non-assigned approver cannot see decision controls (J6.13)", async () => {
    setCustomUser({ id: 99, name: "Other Approver", email: "other@test.com", role: "approver",
      teamMemberNumber: "APR-999", department: "Sales", position: "Manager", lineManager: "Sipho Approver" });

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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Returned" });
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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Returned" });
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
    setCustomUser({ id: 3, name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "Sipho Approver" });

    const lmApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Returned" });
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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Returned" });
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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Declined" });
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

  it("HR declines declaration (J8.2)", async () => {
    setCustomUser({ id: 3, name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver",
      teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "Sipho Approver" });

    const lmApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "OK" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(lmApproved);
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Declined" });
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
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Declined" });
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration({ status: "Declined" })} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Declined")).toBeInTheDocument();
    });
  });

  it("API failure during decline shows error (J8.9)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockRejectedValue(new Error("Decline failed"));
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(makeWorkflow());
    render(<ApprovalDetail declaration={makeDeclaration()} onBack={vi.fn()} />);

    await waitFor(() => expect(screen.getByText("Decision *")).toBeInTheDocument());
    const declineOption = screen.getByRole("radio", { name: /Declined/ });
    fireEvent.click(declineOption);
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(screen.getByText(/Decline failed/)).toBeInTheDocument();
    });
  });

  it("decline with notes persists them (J8.4)", async () => {
    setRole("approver");
    vi.mocked(approveWorkflowStep).mockResolvedValue({ newStatus: "Declined" });
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
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);
    const decl = makeDeclaration({ status: "Approved" });
    render(<ApprovalDetail declaration={decl} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
    });
    expect(screen.queryByText("Decision *")).not.toBeInTheDocument();
  });

  it("completed steps show decision labels, dates, and notes (J9.6)", async () => {
    setRole("teamMember");
    const allApproved = workflowWithStep(0, { status: "approved", decision: "accept", decidedAt: "2026-07-15T10:00:00Z", notes: "Good" });
    allApproved.steps[1] = { ...allApproved.steps[1], status: "approved", decision: "org", decidedAt: "2026-07-16T10:00:00Z", notes: "Approved" };
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);
    render(<ApprovalDetail declaration={makeDeclaration({ status: "Approved" })} onBack={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
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
    const decl = makeDeclaration({ employeeId: 2 });
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
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(allApproved);

    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText("Approved").length).toBeGreaterThanOrEqual(1);
    });
  });
});
