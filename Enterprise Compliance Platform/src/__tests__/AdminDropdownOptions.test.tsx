import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AdminDropdownOptions } from "../app/pages/admin/AdminDropdownOptions";
import { fetchDropdownOptions, updateDropdownOptions } from "../services/api";

vi.mock("../services/api", () => ({
  fetchDropdownOptions: vi.fn(),
  updateDropdownOptions: vi.fn(),
}));

vi.mock("../app/components/notify", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

const seed = { departments: ["Marketing", "IT"], types: ["Gift"] };

// Previously the admin reference-data screens had no unit tests at all.
describe("AdminDropdownOptions", () => {
  it("renders the fetched reference lists", async () => {
    vi.mocked(fetchDropdownOptions).mockResolvedValue(seed);
    render(<AdminDropdownOptions />);
    await waitFor(() => expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0));
    expect(screen.getByText("Dropdown Options Configuration")).toBeInTheDocument();
  });

  it("adds an option optimistically and persists it", async () => {
    vi.mocked(fetchDropdownOptions).mockResolvedValue({ departments: ["Marketing"] });
    vi.mocked(updateDropdownOptions).mockResolvedValue({});
    render(<AdminDropdownOptions />);
    await waitFor(() => expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText(/Add new department/i), { target: { value: "Finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(updateDropdownOptions).toHaveBeenCalledWith({ departments: ["Marketing", "Finance"] });
    });
  });

  it("rolls back and shows an error when persisting fails", async () => {
    vi.mocked(fetchDropdownOptions).mockResolvedValue({ departments: ["Marketing"] });
    vi.mocked(updateDropdownOptions).mockRejectedValue(new Error("Server down"));
    render(<AdminDropdownOptions />);
    await waitFor(() => expect(screen.getAllByText("Marketing").length).toBeGreaterThan(0));
    fireEvent.change(screen.getByPlaceholderText(/Add new department/i), { target: { value: "Finance" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(screen.getByText("Server down")).toBeInTheDocument());
    // Optimistic row removed again.
    expect(screen.queryByText("Finance")).toBeNull();
  });
});
