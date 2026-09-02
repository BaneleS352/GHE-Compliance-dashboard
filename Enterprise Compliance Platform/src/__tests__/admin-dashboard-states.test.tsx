import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminDashboard } from "../app/pages/admin/AdminDashboard";
import { fetchAdminDashboard } from "../services/api";

vi.mock("../services/api", () => ({ fetchAdminDashboard: vi.fn() }));

describe("AdminDashboard loading and failure states", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a loading state before the dashboard request completes", () => {
    vi.mocked(fetchAdminDashboard).mockReturnValue(new Promise(() => {}));
    render(<AdminDashboard onNavigate={vi.fn()} />);
    expect(screen.getByText(/Loading dashboard/)).toBeInTheDocument();
  });

  it("shows API errors and recovered dashboard data", async () => {
    vi.mocked(fetchAdminDashboard).mockRejectedValueOnce(new Error("Database unavailable"));
    const { unmount } = render(<AdminDashboard onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Database unavailable")).toBeInTheDocument());

    vi.mocked(fetchAdminDashboard).mockResolvedValue({ users: 4, declarations: 8, workflows: 2, threshold: 1000 });
    unmount();
    render(<AdminDashboard onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("System Healthy")).toBeInTheDocument());
    expect(screen.getByText(/4 users and 8 declarations in the system/)).toBeInTheDocument();
  });
});
