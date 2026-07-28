import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { WorkflowTimeline, StepView, APPROVAL_OPTIONS, DECISION_LABELS } from "../src/app/components/WorkflowTimeline"

vi.mock("../src/services/api", () => ({
  fetchWorkflowInstance: vi.fn(),
  approveWorkflowStep: vi.fn(),
  updateDeclaration: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks();
  class RO {
    cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width: 400, height: 600 } }]); }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = RO;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

const mockSteps = (overrides?: Partial<StepView>[]): StepView[] => [
  {
    label: "1. Line Manager Approval",
    actor: "Sipho Nkosi",
    state: "completed",
    decision: { label: "Accept" },
    decidedAt: "2026-07-10T08:30:00.000Z",
    notes: "Looks good",
    ...(overrides?.[0] ?? {}),
  },
  {
    label: "2. Head of HR Approval",
    actor: "Lindiwe Zulu",
    state: "active",
    ...(overrides?.[1] ?? {}),
  },
  {
    label: "3. Group CEO Approval",
    actor: "Sandile Shabalala",
    state: "pending",
    ...(overrides?.[2] ?? {}),
  },
];

const mockWfWithSteps = (steps: any[]): any => {
  return {
    declarationId: "GHE-2026-1003",
    steps: steps.map((s, i) => ({
      role: ["lineManager", "hr", "ceo"][i],
      label: s.label,
      assigneeName: s.actor,
      status: i === 1 ? "pending" : (i === 0 ? "approved" : "pending"),
      decision: i === 0 ? "accept" : null,
      decidedAt: i === 0 ? "2026-07-10T08:30:00.000Z" : null,
      notes: i === 0 ? "Looks good" : "",
    })),
  };
};

describe("WorkflowTimeline - Fix for multiple matching elements", () => {
  it("shows different state and decisions text for completed steps", () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" />);
    
    expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
    expect(screen.getByText("Sipho Nkosi")).toBeInTheDocument();
    
    expect(screen.getByText("2. Head of HR Approval")).toBeInTheDocument();
    expect(screen.getByText("Lindiwe Zulu")).toBeInTheDocument();
    
    expect(screen.getByText("3. Group CEO Approval")).toBeInTheDocument();
    expect(screen.getByText("Sandile Shabalala")).toBeInTheDocument();
    
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
    expect(screen.getByText(/Pending/)).toBeInTheDocument();
  });

  it("shows completed step details properly", () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" />);
    
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText(/Accepted/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-10/)).toBeInTheDocument();
  });

  it("shows approval options when active step exists", async () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" />);
    
    await waitFor(() => {
      expect(screen.getByText("Decision *")).toBeInTheDocument();
    });
    
    expect(screen.getByText(/Approved - Team member/)).toBeInTheDocument();
    expect(screen.getByText(/Approved - Organisation Pool/)).toBeInTheDocument();
    expect(screen.getByText(/Approved - Hollywood Foundation/)).toBeInTheDocument();
    expect(screen.getByText(/Declined - Return GHE/)).toBeInTheDocument();
  });
});
