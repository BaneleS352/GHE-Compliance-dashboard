import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { WorkflowTimeline, StepView } from "../app/components/WorkflowTimeline"
import { fetchWorkflowInstance } from "../services/api"

vi.mock("../services/api", () => ({
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
];

const mockWfWithSteps = (steps: any[]): any => {
  return {
    declarationId: "GHE-2026-1003",
    steps: steps.map((s, i) => ({
      role: ["lineManager", "hr"][i],
      label: s.label,
      assigneeName: s.actor,
      status: i === 0 ? "approved" : "pending",
      decision: i === 0 ? "accept" : null,
      decidedAt: i === 0 ? "2026-07-10T08:30:00.000Z" : null,
      notes: i === 0 ? "Looks good" : "",
    })),
  };
};

describe("WorkflowTimeline - Fix for multiple matching elements", () => {
  it("shows different state and decisions text for completed steps", async () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" />);
    
    await waitFor(() => {
      expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
    });
    expect(screen.getByText("Sipho Nkosi")).toBeInTheDocument();
    
    expect(screen.getAllByText("2. Head of HR Approval").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Lindiwe Zulu").length).toBeGreaterThanOrEqual(1);
    
    expect(screen.getAllByText(/Approved/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/In Progress/)).toBeInTheDocument();
  });

  it("shows completed step details properly", async () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" />);
    
    await waitFor(() => {
      expect(screen.getByText("Decision")).toBeInTheDocument();
    });
    expect(screen.getByText(/accept the actual GHE/)).toBeInTheDocument();
    expect(screen.getByText(/2026-07-10/)).toBeInTheDocument();
  });

  it("shows approval options when active step exists", async () => {
    const wf = mockWfWithSteps(mockSteps());
    vi.mocked(fetchWorkflowInstance).mockResolvedValue(wf);
    
    render(<WorkflowTimeline declarationId="GHE-2026-1003" onDecision={vi.fn()} notes="" onNotesChange={vi.fn()} onSubmit={vi.fn()} />);
    
    await waitFor(() => {
      expect(screen.getByText("Decision *")).toBeInTheDocument();
    });
    
    expect(screen.getAllByText(/Approved - Team Member to accept/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approved - Team Member to share.*Organisation Pool/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Approved - Team Member to donate.*Hollywood Foundation/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Declined - Team Member to return/).length).toBeGreaterThan(0);
  });
});
