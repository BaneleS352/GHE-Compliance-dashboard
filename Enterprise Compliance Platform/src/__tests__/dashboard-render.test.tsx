import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ApproverDashboard } from "../app/pages/ApproverDashboard";
import { UserProvider } from "../app/auth/UserContext";

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(() => Promise.resolve("msal-test-token")),
  initializeIdentity: vi.fn(() => Promise.resolve()),
}));

vi.mock("../services/api", () => ({
  fetchDeclarations: vi.fn(() => Promise.resolve([])),
  fetchWorkflowQueue: vi.fn(() => Promise.resolve({ items: [], total: 0 })),
  fetchConfig: vi.fn(() => Promise.resolve({ slaEscalationDays: 3 })),
  fetchPublicConfig: vi.fn(() => Promise.resolve({ highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maximumValue: 1000000 })),
}));

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
  vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: true, status: 200,
    json: () => Promise.resolve({ kpis: {}, complianceTrend: [], typeBreakdown: [] }),
    headers: new Headers(),
  } as Response);
});

describe("ApproverDashboard render", () => {
  it("mounts without throwing (catches real runtime errors)", async () => {
    let err: unknown = null;
    try {
      render(
        <UserProvider>
          <ApproverDashboard onNavigate={() => {}} />
        </UserProvider>
      );
      await screen.findByText("Approver Dashboard");
    } catch (e) {
      err = e;
    }
    if (err) console.error("RENDER ERROR:", err);
    expect(err).toBeNull();
  });
});
