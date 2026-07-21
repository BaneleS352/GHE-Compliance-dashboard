import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkflowTimeline, StepView, APPROVAL_OPTIONS, DECISION_LABELS } from "../app/components/WorkflowTimeline";

vi.mock("../services/api", () => ({
  fetchWorkflowInstance: vi.fn(),
  approveWorkflowStep: vi.fn(),
  updateDeclaration: vi.fn(),
}));

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

describe("WorkflowTimeline", () => {
  it("renders all three roles", () => {
    render(<WorkflowTimeline steps={mockSteps()} />);
    expect(screen.getByText("1. Line Manager Approval")).toBeInTheDocument();
    expect(screen.getByText("2. Head of HR Approval")).toBeInTheDocument();
    expect(screen.getByText("3. Group CEO Approval")).toBeInTheDocument();
  });

  it("shows completed state with decision badge", () => {
    render(<WorkflowTimeline steps={mockSteps()} />);
    expect(screen.getAllByText("Accept").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Completed/)).toBeInTheDocument();
  });

  it("shows active state for current step", () => {
    render(<WorkflowTimeline steps={mockSteps()} />);
    expect(screen.getAllByText("In Progress")).toHaveLength(1);
  });

  it("shows pending state for future step", () => {
    render(<WorkflowTimeline steps={mockSteps()} />);
    expect(screen.getAllByText("Pending").length).toBeGreaterThanOrEqual(1);
  });

  it("shows decision radio options when active with onDecision callback", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    expect(screen.getByText("Decision *")).toBeInTheDocument();
    expect(screen.getByText(/Return - Team member/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*accept the actual GHE/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*Organisation Pool/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*Hollywood Foundation/)).toBeInTheDocument();
    expect(screen.getByText(/Declined.*return the actual GHE/)).toBeInTheDocument();
  });

  it("shows notes textarea when onNotesChange is provided", () => {
    render(<WorkflowTimeline steps={mockSteps()} onDecision={vi.fn()} onNotesChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Add notes or reasoning...")).toBeInTheDocument();
  });

  it("calls onDecision when a radio option is clicked", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} onNotesChange={vi.fn()} />);
    fireEvent.click(screen.getByText(/Approved.*accept the actual GHE/));
    expect(onDecision).toHaveBeenCalledWith("accept");
  });

  it("calls onDecision when radio label is clicked", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    fireEvent.click(screen.getByText(/Return - Team member/));
    expect(onDecision).toHaveBeenCalledWith("return");
  });

  it("calls onNotesChange when notes change", () => {
    const onNotesChange = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} onDecision={vi.fn()} onNotesChange={onNotesChange} />);
    const textarea = screen.getByPlaceholderText("Add notes or reasoning...");
    fireEvent.change(textarea, { target: { value: "test note" } });
    expect(onNotesChange).toHaveBeenCalledWith("test note");
  });

  it("renders submit button when onSubmit is provided", () => {
    render(<WorkflowTimeline steps={mockSteps()} onSubmit={vi.fn()} />);
    expect(screen.getByText("Submit Decision")).toBeInTheDocument();
  });

  it("submit button is disabled when submitDisabled is true", () => {
    render(<WorkflowTimeline steps={mockSteps()} onSubmit={vi.fn()} submitDisabled />);
    expect(screen.getByText("Submit Decision")).toBeDisabled();
  });

  it("shows Decision Submitted when submitted is true", () => {
    render(<WorkflowTimeline steps={mockSteps()} onSubmit={vi.fn()} submitted />);
    expect(screen.getByText("Decision Submitted")).toBeInTheDocument();
  });

  it("hides decision buttons when onDecision is not provided", () => {
    render(<WorkflowTimeline steps={mockSteps()} />);
    expect(screen.queryByText("Please select a decision")).not.toBeInTheDocument();
    expect(screen.queryByText("Submit Decision")).not.toBeInTheDocument();
  });

  it("shows Waiting for approval when step is active but no decision callback", () => {
    const steps: StepView[] = [
      { label: "LM", actor: "Sipho", state: "completed", decision: { label: "Accept" } },
      { label: "HR", actor: "Lindiwe", state: "active" },
    ];
    render(<WorkflowTimeline steps={steps} />);
    expect(screen.getByText(/Waiting for approval from/)).toBeInTheDocument();
  });

  it("shows skipped state correctly", () => {
    const steps: StepView[] = [
      { label: "LM", actor: "Sipho", state: "completed", decision: { label: "Accept" } },
      { label: "HR", actor: "Lindiwe", state: "skipped" },
      { label: "CEO", actor: "Sandile", state: "pending" },
    ];
    render(<WorkflowTimeline steps={steps} />);
    expect(screen.getByText("Not Required")).toBeInTheDocument();
    expect(screen.getByText("Not required for this declaration.")).toBeInTheDocument();
  });

  it("displays completed step notes", () => {
    const steps: StepView[] = [
      { label: "LM", actor: "Sipho", state: "completed", decision: { label: "Accept" }, notes: "Approved with conditions" },
    ];
    render(<WorkflowTimeline steps={steps} />);
    expect(screen.getByText(/"Approved with conditions"/)).toBeInTheDocument();
  });

  it("renders all 5 approval options as radio labels", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    expect(screen.getByText(/Return - Team member/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*accept the actual GHE/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*Organisation Pool/)).toBeInTheDocument();
    expect(screen.getByText(/Approved.*Hollywood Foundation/)).toBeInTheDocument();
    expect(screen.getByText(/Declined.*return the actual GHE/)).toBeInTheDocument();
  });

  it("highlights actively selected radio option", () => {
    render(<WorkflowTimeline steps={mockSteps()} decision="accept" onDecision={vi.fn()} />);
    const label = screen.getByText(/Approved.*accept the actual GHE/).closest("label")!;
    expect(label.className).toContain("border-purple-600");
  });

  it("renders read-only completed decisions for all roles", () => {
    const steps: StepView[] = [
      { label: "LM", actor: "Sipho", state: "completed", decision: { label: "Org Pool" }, decidedAt: "2026-07-10T08:00:00.000Z" },
      { label: "HR", actor: "Lindiwe", state: "completed", decision: { label: "Foundation" }, decidedAt: "2026-07-11T09:00:00.000Z" },
      { label: "CEO", actor: "Sandile", state: "completed", decision: { label: "Accept" }, decidedAt: "2026-07-12T10:00:00.000Z" },
    ];
    render(<WorkflowTimeline steps={steps} />);
    expect(screen.getByText("Org Pool")).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("Accept")).toBeInTheDocument();
  });
});

describe("ApprovalDetail handleSubmit logic", () => {
  it("all approval options exist in the APPROVAL_OPTIONS config", () => {
    const values = APPROVAL_OPTIONS.map((d) => d.value);
    expect(values).toContain("return");
    expect(values).toContain("accept");
    expect(values).toContain("org");
    expect(values).toContain("foundation");
    expect(values).toContain("decline");
  });

  it("APPROVAL_OPTIONS labels are descriptive", () => {
    const opt = (v: string) => APPROVAL_OPTIONS.find((o) => o.value === v)!;
    expect(opt("return").label).toContain("Return");
    expect(opt("accept").label).toContain("accept");
    expect(opt("org").label).toContain("Organisation Pool");
    expect(opt("foundation").label).toContain("Foundation");
    expect(opt("decline").label).toContain("Declined");
  });

  it("DECISION_LABELS maps decisions correctly", () => {
    expect(DECISION_LABELS.accept).toBe("Accept");
    expect(DECISION_LABELS.return).toBe("Return");
    expect(DECISION_LABELS.org).toBe("Org Pool");
    expect(DECISION_LABELS.foundation).toBe("Foundation");
    expect(DECISION_LABELS.decline).toBe("Decline");
  });
});

describe("WorkflowTimeline built-in auto-fetch", () => {
  it("fetches workflow when declarationId is provided without steps", async () => {
    const { fetchWorkflowInstance } = await import("../services/api");
    (fetchWorkflowInstance as any).mockResolvedValue({
      steps: [
        { role: "lineManager", label: "LM", assigneeName: "Sipho", status: "pending" },
      ],
    });
    render(<WorkflowTimeline declarationId="GHE-001" />);
    expect(fetchWorkflowInstance).toHaveBeenCalledWith("GHE-001");
  });
});
