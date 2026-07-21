import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ApprovalQueue } from "../app/pages/ApprovalQueue";
import { fetchDeclarations } from "../services/api";
import { exportRowsToXls } from "../utils/excel";

const mockQueue = [
  {
    id: "GHE-2026-1001", employee: "Alice", employeeId: "user-1", department: "IT",
    type: "Gift", Counterparty: "CorpA", value: 500, submitted: "2026-07-01",
    approver: "Bob", status: "Pending" as const, priority: "High" as const,
    description: "Test", relationship: "Yes", teamMemberNumber: "TM-001",
    lineManager: "Bob", position: "Dev", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Jane", biddingProcess: "No",
    occasion: "Business Meeting", date: "2026-07-01", instances: "1",
    publicOfficial: "No",
  },
  {
    id: "GHE-2026-1002", employee: "Charlie", employeeId: "user-2", department: "Marketing",
    type: "Hospitality", Counterparty: "CorpB", value: 200, submitted: "2026-06-15",
    approver: "Bob", status: "Escalated" as const, priority: "Medium" as const,
    description: "Lunch", relationship: "No", teamMemberNumber: "TM-002",
    lineManager: "Dave", position: "Mgr", receivedGiven: "Given",
    from: "Customer", contactPerson: "John", biddingProcess: "N/A",
    occasion: "Business Meeting", date: "2026-06-10", instances: "2",
    publicOfficial: "No",
  },
  {
    id: "GHE-2026-1003", employee: "Eve", employeeId: "user-3", department: "Sales",
    type: "Entertainment", Counterparty: "CorpC", value: 1500, submitted: "2026-07-10",
    approver: "Bob", status: "Pending" as const, priority: "Low" as const,
    description: "Event", relationship: "Yes", teamMemberNumber: "TM-003",
    lineManager: "Frank", position: "Mgr", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Sue", biddingProcess: "No",
    occasion: "Festive Season", date: "2026-07-05", instances: "1",
    publicOfficial: "No",
  },
];

const mockNonQueue = [
  {
    id: "GHE-2026-1004", employee: "Alice", employeeId: "user-1", department: "IT",
    type: "Gift", Counterparty: "CorpD", value: 100, submitted: "2026-07-01",
    approver: "Bob", status: "Approved" as const, priority: "Low" as const,
    description: "Done", relationship: "No", teamMemberNumber: "TM-001",
    lineManager: "Bob", position: "Dev", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Jill", biddingProcess: "No",
    occasion: "Business Meeting", date: "2026-07-01", instances: "1",
    publicOfficial: "No",
  },
];

vi.mock("../services/api", () => ({
  fetchDeclarations: vi.fn(),
}));

vi.mock("../utils/excel", () => ({
  exportRowsToXls: vi.fn(),
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
    vi.mocked(fetchDeclarations).mockReturnValue(new Promise(() => {}));
    render(<ApprovalQueue onReview={vi.fn()} />);
    expect(screen.getByText("Loading queue…")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(fetchDeclarations).mockRejectedValue(new Error("Failed to load"));
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load queue/)).toBeInTheDocument();
    });
  });

  it("renders only Pending/Escalated/Info Requested declarations", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue([...mockQueue, ...mockNonQueue]);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText("GHE-2026-1004").length).toBe(0);
  });

  it("filters by search text", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText("Search declarations...");
    fireEvent.change(searchInput, { target: { value: "CorpC" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("filters by department", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const deptSelect = screen.getByRole("combobox", { name: /department/i });
    fireEvent.change(deptSelect, { target: { value: "Marketing" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("shows and uses advanced filters", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const filtersBtn = screen.getByRole("button", { name: /Filters/i });
    fireEvent.click(filtersBtn);

    const statusSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(statusSelect, { target: { value: "Escalated" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("filters by priority", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const filtersBtn = screen.getByRole("button", { name: /Filters/i });
    fireEvent.click(filtersBtn);

    const prioritySelect = screen.getAllByRole("combobox")[2];
    fireEvent.change(prioritySelect, { target: { value: "High" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
    });
  });

  it("calls onReview when Review button is clicked", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    const onReview = vi.fn();
    render(<ApprovalQueue onReview={onReview} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const reviewBtns = screen.getAllByRole("button", { name: /Review/i });
    fireEvent.click(reviewBtns[0]);
    expect(onReview).toHaveBeenCalledWith(expect.objectContaining({ id: "GHE-2026-1001" }));
  });

  it("calls exportRowsToXls on Export button click", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const exportBtn = screen.getByRole("button", { name: /Export/i });
    fireEvent.click(exportBtn);
    expect(exportRowsToXls).toHaveBeenCalled();
  });

  it("shows empty state when no declarations match filters", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockQueue);
    render(<ApprovalQueue onReview={vi.fn()} />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText("Search declarations...");
    fireEvent.change(searchInput, { target: { value: "ZZZ_NONEXISTENT" } });
    await waitFor(() => {
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
      expect(screen.queryAllByText("GHE-2026-1002").length).toBe(0);
      expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
    });
  });
});
