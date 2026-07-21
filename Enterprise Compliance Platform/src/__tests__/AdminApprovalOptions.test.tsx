import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import { UserProvider } from "../app/auth/UserContext";
import { AdminApprovalOptions } from "../app/pages/admin/AdminApprovalOptions";

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

    expect(screen.getByText("Approval Options Configuration")).toBeTruthy();
    const acceptItems = await screen.findAllByText("Accept");
    expect(acceptItems.length).toBeGreaterThanOrEqual(1);
    const declineItems = screen.getAllByText("Decline");
    expect(declineItems.length).toBeGreaterThanOrEqual(1);
  });
});