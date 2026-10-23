import { describe, expect, it } from "vitest";
import { landingScreenForUser, roleForScreen } from "../app/screenPolicy";

describe("screen policy", () => {
  it("centralizes role ownership for screens", () => {
    expect(roleForScreen("admin-reports")).toBe("admin");
    expect(roleForScreen("approval-queue")).toBe("approver");
    expect(roleForScreen("new-declaration")).toBe("teamMember");
  });

  it("selects the role-specific landing screen", () => {
    const base = { id: 1, name: "User", email: "u@example.com", teamMemberNumber: "TM-1", department: "IT", position: "Engineer", lineManager: null };
    expect(landingScreenForUser({ ...base, role: "admin" })).toBe("admin-dashboard");
    expect(landingScreenForUser({ ...base, role: "approver" })).toBe("approver-dashboard");
    expect(landingScreenForUser({ ...base, role: "teamMember" })).toBe("new-declaration");
  });
});
