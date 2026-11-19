import { describe, it, expect, vi, beforeAll } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { UserProvider } from "../app/auth/UserContext";
import { AdminApprovalOptions } from "../app/pages/admin/AdminApprovalOptions";

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(() => Promise.resolve("msal-test-token")),
  initializeIdentity: vi.fn(() => Promise.resolve()),
}));

beforeAll(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true, status: 200,
    json: () => Promise.resolve([
      { value: "accept", label: "Accept" },
      { value: "decline", label: "Decline" },
    ]),
    headers: new Headers(),
  } as Response);
});

describe("AdminApprovalOptions", () => {
  it("renders the page header and options table", async () => {
    render(
      <UserProvider>
        <AdminApprovalOptions />
      </UserProvider>
    );

    expect(await screen.findByText("Approval Options Configuration")).toBeTruthy();
    const acceptItems = await screen.findAllByText("Accept");
    expect(acceptItems.length).toBeGreaterThanOrEqual(1);
    const declineItems = screen.getAllByText("Decline");
    expect(declineItems.length).toBeGreaterThanOrEqual(1);
  });

  it("focuses the add dialog, closes it on Escape, and restores focus", async () => {
    render(
      <UserProvider>
        <AdminApprovalOptions />
      </UserProvider>,
    );
    const trigger = await screen.findByRole("button", { name: "Add" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Add approval option" });
    expect(document.activeElement).toBe(dialog.querySelector("input"));
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add approval option" })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });
});
