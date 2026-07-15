import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MyDeclarationsScreen } from "../app/pages/MyDeclarationsScreen";
import { fetchDeclarations } from "../services/api";
import { exportRowsToXls } from "../utils/excel";

const mockDeclarations = [
  {
    id: "GHE-2026-1001", employee: "Alice", employeeId: "user-1", department: "IT",
    type: "Gift", Counterparty: "CorpA", value: 500, submitted: "2026-07-01",
    approver: "Bob", status: "Pending" as const, priority: "Medium" as const,
    description: "Test", relationship: "Yes", teamMemberNumber: "TM-001",
    lineManager: "Bob", position: "Dev", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Jane", biddingProcess: "No",
    occasion: "Business Meeting", date: "2026-07-01", instances: "1",
    publicOfficial: "No",
  },
  {
    id: "GHE-2026-1002", employee: "Alice", employeeId: "user-1", department: "Marketing",
    type: "Hospitality", Counterparty: "CorpB", value: 200, submitted: "2026-06-15",
    approver: "Carol", status: "Approved" as const, priority: "Low" as const,
    description: "Dinner", relationship: "No", teamMemberNumber: "TM-001",
    lineManager: "Bob", position: "Dev", receivedGiven: "Given",
    from: "Customer", contactPerson: "John", biddingProcess: "N/A",
    occasion: "Business Meeting", date: "2026-06-10", instances: "2",
    publicOfficial: "No",
  },
  {
    id: "GHE-2026-1003", employee: "Charlie", employeeId: "user-2", department: "Sales",
    type: "Entertainment", Counterparty: "CorpC", value: 1500, submitted: "2026-07-10",
    approver: "Dave", status: "Draft" as const, priority: "High" as const,
    description: "Event", relationship: "Yes", teamMemberNumber: "TM-002",
    lineManager: "Dave", position: "Mgr", receivedGiven: "Received",
    from: "Supplier", contactPerson: "Sue", biddingProcess: "No",
    occasion: "Festive Season", date: "2026-07-05", instances: "1",
    publicOfficial: "No",
  },
];

vi.mock("../services/api", () => ({
  fetchDeclarations: vi.fn(),
}));

vi.mock("../app/auth/UserContext", () => ({
  useUser: () => ({
    user: { id: "user-1", name: "Alice", email: "alice@test.com", role: "teamMember" as const,
            teamMemberNumber: "TM-001", department: "IT", position: "Dev", lineManager: "Bob" },
  }),
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

describe("MyDeclarationsScreen", () => {
  it("shows loading state initially", () => {
    vi.mocked(fetchDeclarations).mockReturnValue(new Promise(() => {}));
    render(<MyDeclarationsScreen />);
    expect(screen.getByText("Loading declarations…")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    vi.mocked(fetchDeclarations).mockRejectedValue(new Error("Network failure"));
    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Network failure/)).toBeInTheDocument();
    });
  });

  it("renders declarations table with user's declarations in 'my' mode", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0);
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
  });

  it("switches to 'all' mode and shows all declarations", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
    });
  });

  it("filters by", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText(/Declaration ID/i);
    fireEvent.change(searchInput, { target: { value: "CorpC" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0);
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
    });
  });

  it("filters by status", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    const statusSelect = screen.getAllByRole("combobox")[1];
    fireEvent.change(statusSelect, { target: { value: "Approved" } });
    await waitFor(() => {
      expect(screen.getAllByText("GHE-2026-1002").length).toBeGreaterThan(0);
    });
  });

  it("shows KPI card counts", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => {
      expect(screen.getByText("Total")).toBeInTheDocument();
    });
  });

  it("calls exportRowsToXls on Export button click", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));
    const exportBtn = screen.getByRole("button", { name: /Export Excel/i });
    fireEvent.click(exportBtn);
    expect(exportRowsToXls).toHaveBeenCalled();
  });

  it("shows empty state when no declarations match filters", async () => {
    vi.mocked(fetchDeclarations).mockResolvedValue(mockDeclarations);
    render(<MyDeclarationsScreen />);
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1001").length).toBeGreaterThan(0));

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    await waitFor(() => expect(screen.getAllByText("GHE-2026-1003").length).toBeGreaterThan(0));

    const searchInput = screen.getByPlaceholderText(/Declaration ID/i);
    fireEvent.change(searchInput, { target: { value: "ZZZ_NONEXISTENT" } });
    await waitFor(() => {
      expect(screen.queryAllByText("GHE-2026-1001").length).toBe(0);
      expect(screen.queryAllByText("GHE-2026-1002").length).toBe(0);
      expect(screen.queryAllByText("GHE-2026-1003").length).toBe(0);
    });
  });
});
