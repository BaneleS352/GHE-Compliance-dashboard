import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalDetail } from "../app/pages/ApprovalDetail";
import { fetchWorkflowInstance, approveWorkflowStep, fetchConfig } from "../services/api";

const mockDeclaration = {
  id: "GHE-2026-1001", employee: "Alice", employeeId: "user-1", department: "IT",
  type: "Gift", Counterparty: "CorpA", value: 5000, submitted: "2026-07-01",
  approver: "Sipho Nkosi", status: "Pending" as const, priority: "High" as const,
  description: "Test", relationship: "Yes", teamMemberNumber: "TM-001",
  lineManager: "Sipho Nkosi", position: "Dev", receivedGiven: "Received",
  from: "Supplier", contactPerson: "Jane", biddingProcess: "No",
  occasion: "Business Meeting", date: "2026-07-01", instances: "1",
  publicOfficial: "No",
};

const mockWorkflow = {
  declarationId: "GHE-2026-1001",
  steps: [
    { order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi",
      label: "Line Manager Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
    { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu",
      label: "HR Review", status: "pending" as const, decision: null, notes: "", decidedAt: null },
    { order: 3, role: "ceo", assignee: "user-5", assigneeName: "Sandile Shabalala",
      label: "CEO Approval", status: "pending" as const, decision: null, notes: "", decidedAt: null },
  ],
};

let mockUserStep: any;

vi.mock("../services/api", () => ({
  fetchWorkflowInstance: vi.fn(),
  approveWorkflowStep: vi.fn(),
  fetchConfig: vi.fn(() => Promise.resolve({
    highValueThreshold: 2000, mediumValueThreshold: 250,
    slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "",
  })),
}));

vi.mock("../app/auth/UserContext", () => ({
  useUser: () => ({
    user: { id: "user-current", name: "Current User", email: "cur@test.com", role: "approver" as const,
            teamMemberNumber: "APR-001", department: "Marketing", position: "LM", lineManager: "user-5" },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  class RO {
    cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width: 800, height: 600 } }]); }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = RO;
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
  mockUserStep = {
    ...mockWorkflow,
    steps: mockWorkflow.steps.map((s, i) =>
      i === 0 ? { ...s, assignee: "user-current" } : { ...s }
    ),
  };
});

describe("ApprovalDetail", () => {
  it("shows loading state while fetching workflow", () => {
    vi.mocked(fetchWorkflowInstance).mockReturnValue(new Promise(() => {}));
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    expect(screen.getByText("Loading workflow…")).toBeInTheDocument();
  });

  it("renders declaration info and workflow after load", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("GHE-2026-1001")).toBeInTheDocument();
    });
    expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
    expect(screen.getByText("2. Head of HR Approval")).toBeInTheDocument();
    expect(screen.getByText("3. Group CEO Approval")).toBeInTheDocument();
  });

  it("shows decision buttons for the current user's pending step", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("Please select a decision")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
  });

  it("does not crash when user has no pending step (accessibility view)", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockWorkflow);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText("GHE-2026-1001")).toBeInTheDocument();
    });
    expect(screen.queryByText("Please select a decision")).not.toBeInTheDocument();
  });

  it("selects a decision and updates button highlight", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    });

    const acceptBtn = screen.getByRole("button", { name: /Accept/ });
    fireEvent.click(acceptBtn);
    expect(acceptBtn.className).toContain("shadow-[0_0_0_2px_currentColor_inset]");
  });

  it("submits decision and calls approveWorkflowStep", async () => {
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Pending" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    const submitBtn = screen.getByText("Submit Decision");
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(approveWorkflowStep).toHaveBeenCalledWith(
        expect.objectContaining({ declarationId: "GHE-2026-1001", decision: "accept" })
      );
    });
  });

  it("shows success message after submission", async () => {
    vi.mocked(approveWorkflowStep).mockResolvedValue({ status: "Pending" } as any);
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    fireEvent.click(screen.getByText("Submit Decision"));

    await waitFor(() => {
      expect(screen.getByText("Decision submitted successfully.")).toBeInTheDocument();
    });
  });

  it("calls onBack when Back button is clicked", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    const onBack = vi.fn();
    render(<ApprovalDetail declaration={mockDeclaration} onBack={onBack} />);
    await waitFor(() => {
      expect(screen.getByText("GHE-2026-1001")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows notes textarea when user has pending step", async () => {
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(mockUserStep);
    render(<ApprovalDetail declaration={mockDeclaration} onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Add notes or reasoning...")).toBeInTheDocument();
    });
  });
});
