import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalQueue } from "../app/pages/ApprovalQueue";
import { fetchWorkflowQueue } from "../services/api";
import { requestProtectedDocument, saveBlob } from "../services/download";

const mockQueueItems = [
  {
    declaration: {
      id: "GHE-2026-1001", employee: "Alice", employeeId: 1, department: "IT",
      type: "Gift", counterparty: "CorpA", value: 500, submitted: "2026-07-01",
      approver: "Bob", status: "Pending" as const, priority: "High" as const,
      description: "Test", relationship: "Yes", teamMemberNumber: "TM-001",
      lineManager: "Bob", position: "Dev", receivedGiven: "Received",
      from: "Supplier", contactPerson: "Jane", biddingProcess: "No",
      occasion: "Business Meeting", date: "2026-07-01", instances: "1",
      publicOfficial: "No",
    },
    step: { order: 1, role: "lineManager", assignee: 7, assigneeName: "Bob", label: "Line Manager", status: "pending" as const },
  },
  {
    declaration: {
      id: "GHE-2026-1002", employee: "Charlie", employeeId: 2, department: "Marketing",
      type: "Hospitality", counterparty: "CorpB", value: 200, submitted: "2026-06-15",
      approver: "Bob", status: "Escalated" as const, priority: "Medium" as const,
      description: "Lunch", relationship: "No", teamMemberNumber: "TM-002",
      lineManager: "Dave", position: "Mgr", receivedGiven: "Given",
      from: "Customer", contactPerson: "John", biddingProcess: "N/A",
      occasion: "Business Meeting", date: "2026-06-10", instances: "2",
      publicOfficial: "No",
    },
    step: { order: 2, role: "hr", assignee: 7, assigneeName: "Bob", label: "HR Review", status: "pending" as const },
  },
  {
    declaration: {
      id: "GHE-2026-1003", employee: "Eve", employeeId: 3, department: "Sales",
      type: "Entertainment", counterparty: "CorpC", value: 1500, submitted: "2026-07-10",
      approver: "Bob", status: "Pending" as const, priority: "Low" as const,
      description: "Event", relationship: "Yes", teamMemberNumber: "TM-003",
      lineManager: "Frank", position: "Mgr", receivedGiven: "Received",
      from: "Supplier", contactPerson: "Sue", biddingProcess: "No",
      occasion: "Festive Season", date: "2026-07-05", instances: "1",
      publicOfficial: "No",
    },
    step: { order: 2, role: "hr", assignee: 7, assigneeName: "Bob", label: "HR Review", status: "pending" as const },
  },
];

vi.mock("../services/api", () => ({
  fetchWorkflowQueue: vi.fn(),
  // ApprovalQueue lazy-loads the SLA configuration after loading the queue.
  // Keep this export in the mock so the async side effect is observable without
  // producing an unhandled Vitest mock error.
  fetchConfig: vi.fn().mockResolvedValue({ slaEscalationDays: 5 }),
}));

vi.mock("../utils/excel", () => ({
  exportRowsToXls: vi.fn(),
  buildRowsXlsxBlob: vi.fn(() => new Blob(["x"], { type: "application/octet-stream" })),
}));

vi.mock("../services/download", () => ({
  requestProtectedDocument: vi.fn(),
  saveBlob: vi.fn(),
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
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

describe("ApprovalQueue", () => {
  it("shows loading state initially", () => {
    vi.mocked(fetchWorkflowQueue).mockReturnValue(new Promise(() => {}));
    render(<ApprovalQueue onReview={vi.fn()} />);
    expect(screen.getByText(/Loading queue/)).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(fetchWorkflowQueue).mockRejectedValue(new Error("Failed to load"));
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load queue/)).toBeInTheDocument();
    });
  });

  it("renders actionable queue items returned by the workflow API", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
    });
  });

  it("filters by search text", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText("ID, Employee or Counterparty");
    fireEvent.change(searchInput, { target: { value: "CorpC" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("filters by department", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const deptSelect = screen.getByDisplayValue("All Departments");
    fireEvent.change(deptSelect, { target: { value: "Marketing" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("filters by priority", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const prioritySelect = screen.getByDisplayValue("All Priorities");
    fireEvent.change(prioritySelect, { target: { value: "High" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
    });
  });

  it("calls onReview when Review button is clicked", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    const onReview = vi.fn();
    render(<ApprovalQueue onReview={onReview} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const reviewBtns = screen.getAllByRole("button", { name: /Review/i });
    fireEvent.click(reviewBtns[0]);
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ id: "GHE-2026-1001" }));
  });

  it("protects the export: Export opens the password dialog, confirm downloads", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    const outBlob = new Blob(["protected"], { type: "application/pdf" });
    vi.mocked(requestProtectedDocument).mockResolvedValue({ blob: outBlob, filename: "protected-ApprovalQueue.xlsx" });
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Export/i }));
    // Password dialog appears; nothing is sent yet.
    expect(screen.getByRole("dialog", { name: "Protect Excel export" })).toBeInTheDocument();
    expect(requestProtectedDocument).not.toHaveBeenCalled();

    const [passwordInput, confirmInput] = screen.getAllByLabelText(/password/i);
    fireEvent.change(passwordInput, { target: { value: "s3cret-download-pw" } });
    fireEvent.change(confirmInput, { target: { value: "s3cret-download-pw" } });
    fireEvent.click(screen.getByRole("button", { name: "Protect & Download" }));

    await waitFor(() => expect(requestProtectedDocument).toHaveBeenCalledTimes(1));
    const [sentBlob, sentName, sentPassword] = vi.mocked(requestProtectedDocument).mock.calls[0];
    expect(sentBlob).toBeInstanceOf(Blob);
    expect(sentName).toMatch(/ApprovalQueue_.*\.xlsx/);
    expect(sentPassword).toBe("s3cret-download-pw");
    expect(saveBlob).toHaveBeenCalledWith(outBlob, "protected-ApprovalQueue.xlsx");
  });

  it("cancelling the password dialog downloads nothing", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: /Export/i }));
    expect(screen.getByRole("dialog", { name: "Protect Excel export" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Protect Excel export" })).not.toBeInTheDocument();
    expect(requestProtectedDocument).not.toHaveBeenCalled();
    expect(saveBlob).not.toHaveBeenCalled();
  });

  it("shows empty state when no declarations match filters", async () => {
    vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText("ID, Employee or Counterparty");
    fireEvent.change(searchInput, { target: { value: "ZZZ_NONEXISTENT" } });
    await waitFor(() => {
      const footnote = screen.getByText(/Showing/).closest("div");
      expect(footnote?.textContent).toMatch(/Showing.*0.*declarations/);
    });
  });

  it("refetches queue records and total on ghe:queue-changed", async () => {
    const first = vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems, total: mockQueueItems.length } as any);
    const { unmount } = render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));
    expect(screen.getByText(/3 actionable approvals/)).toBeInTheDocument();
    expect(first).toHaveBeenCalledTimes(1);

    // A workflow action elsewhere shrinks the queue to one record.
    const second = vi.mocked(fetchWorkflowQueue).mockResolvedValue({ items: mockQueueItems.slice(0, 1), total: 1 } as any);
    window.dispatchEvent(new Event("ghe:queue-changed"));
    await waitFor(() => expect(second).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByText(/1 actionable approvals/)).toBeInTheDocument());
    expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
    unmount();
  });
});
