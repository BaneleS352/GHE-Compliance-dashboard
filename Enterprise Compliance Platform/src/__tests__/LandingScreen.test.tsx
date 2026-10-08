import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LandingScreen } from "../app/pages/LandingScreen";
import { authenticate } from "../app/auth/authService";

vi.mock("../app/auth/authService", () => ({
  authenticate: vi.fn(),
}));

// The auth entry point every user hits: provider sign-in only (no demo or
// password path exists to test).
describe("LandingScreen", () => {
  it("renders the provider sign-in call to action", () => {
    render(<LandingScreen />);
    expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in with Microsoft" })).toBeInTheDocument();
  });

  it("starts provider sign-in on submit", async () => {
    vi.mocked(authenticate).mockResolvedValue(undefined);
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => expect(authenticate).toHaveBeenCalledTimes(1));
  });

  it("shows a generic error when sign-in cannot start", async () => {
    vi.mocked(authenticate).mockRejectedValue(new Error("misconfigured"));
    render(<LandingScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Microsoft" }));
    await waitFor(() => {
      expect(screen.getByText("Sign-in could not be started. Please contact support.")).toBeInTheDocument();
    });
    // No provider detail leaks into the message.
    expect(screen.queryByText(/misconfigured/)).toBeNull();
  });
});
