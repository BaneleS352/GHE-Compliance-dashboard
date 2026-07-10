import { describe, it, expect, beforeAll, vi } from "vitest";
import { render } from "@testing-library/react";
import { ApproverDashboard } from "../app/pages/ApproverDashboard";
import { UserProvider } from "../app/auth/UserContext";
import { invalidateCache } from "../data/db";

beforeAll(() => {
  class RO {
    cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width: 800, height: 300 } }]); }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = RO;
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 300 });
});

describe("ApproverDashboard render", () => {
  it("mounts without throwing (catches real runtime errors)", () => {
    invalidateCache();
    const user = {
      id: "user-3", name: "Sipho Nkosi", email: "sipho@hb.co.za", passwordHash: "", role: "approver" as const,
      teamMemberNumber: "HB-10001", department: "Marketing", position: "Line Manager", lineManager: null,
    };
    let err: unknown = null;
    try {
      render(
        <UserProvider>
          <ApproverDashboard onNavigate={() => {}} />
        </UserProvider>
      );
    } catch (e) {
      err = e;
    }
    if (err) console.error("RENDER ERROR:", err);
    expect(err).toBeNull();
  });
});
