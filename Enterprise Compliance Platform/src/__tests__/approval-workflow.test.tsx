import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkflowTimeline, StepView, DECISION_BUTTONS, DECISION_LABELS } from "../app/components/WorkflowTimeline";

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

  it("shows decision select and buttons when active with onDecision callback", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    expect(screen.getByText("Please select a decision")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decline/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Return for More Info/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escalate/ })).toBeInTheDocument();
  });

  it("shows notes textarea when onNotesChange is provided", () => {
    render(<WorkflowTimeline steps={mockSteps()} onDecision={vi.fn()} onNotesChange={vi.fn()} />);
    expect(screen.getByPlaceholderText("Add notes or reasoning...")).toBeInTheDocument();
  });

  it("calls onDecision when a decision button is clicked", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} onNotesChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onDecision).toHaveBeenCalledWith("accept");
  });

  it("calls onDecision when select changes", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "accept" } });
    expect(onDecision).toHaveBeenCalledWith("accept");
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

  it("handles all 5 decision button variants", () => {
    const onDecision = vi.fn();
    render(<WorkflowTimeline steps={mockSteps()} decision={null} onDecision={onDecision} />);
    expect(screen.getByRole("button", { name: /Accept/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Decline/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Return for More Info/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Escalate/ })).toBeInTheDocument();
  });

  it("highlights actively selected decision button", () => {
    render(<WorkflowTimeline steps={mockSteps()} decision="accept" onDecision={vi.fn()} />);
    const acceptBtn = screen.getByRole("button", { name: /Accept/ });
    expect(acceptBtn.className).toContain("shadow-[0_0_0_2px_currentColor_inset]");
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
  it("all decision buttons exist in the DECISION_BUTTONS config", () => {
    // Verify all 5 decisions from the backend validDecisions are represented in the UI
    const values = DECISION_BUTTONS.map((d) => d.value);
    expect(values).toContain("accept");
    expect(values).toContain("reject");
    expect(values).toContain("decline");
    expect(values).toContain("info");
    expect(values).toContain("escalate");
  });

  it("DECISION_LABELS maps decisions correctly", () => {
    expect(DECISION_LABELS.accept).toBe("Accept");
    expect(DECISION_LABELS.reject).toBe("Reject");
    expect(DECISION_LABELS.decline).toBe("Decline");
    expect(DECISION_LABELS.info).toBe("Return for More Info");
    expect(DECISION_LABELS.escalate).toBe("Escalate");
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
