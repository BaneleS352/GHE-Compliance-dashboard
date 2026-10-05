import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticate, canAccessScreen, fetchCurrentUser, isIdentityAuthenticated, logoutFromIdentityProvider } from "../app/auth/authService";
import { activeAccount, signIn, signOut, getApiToken } from "../app/auth/msal";

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(),
  initializeIdentity: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.mocked(getApiToken).mockResolvedValue("msal-test-token");
});

describe("Auth — MSAL adapter contract", () => {
  it("authenticate() starts provider sign-in (no passwords)", async () => {
    await authenticate();
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("isIdentityAuthenticated reflects the MSAL account", () => {
    vi.mocked(activeAccount).mockReturnValue(null);
    expect(isIdentityAuthenticated()).toBe(false);
    vi.mocked(activeAccount).mockReturnValue({ username: "a@b.c" } as never);
    expect(isIdentityAuthenticated()).toBe(true);
  });

  it("logout clears the provider session", () => {
    logoutFromIdentityProvider();
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("API calls carry the MSAL bearer token", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true, status: 200,
      json: () => Promise.resolve({ id: 1, email: "admin@hb.co.za", role: "admin" }),
      headers: new Headers(),
    } as Response);
    await fetchCurrentUser();
    const [, options] = spy.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(options.headers.Authorization).toBe("Bearer msal-test-token");
  });

  it("fetchCurrentUser returns null on a 401", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({ error: "Unauthorized" }), headers: new Headers() } as Response);
    await expect(fetchCurrentUser()).resolves.toBeNull();
  });

  it("fetchCurrentUser returns the refreshed server user", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ id: 1, name: "Updated User", email: "u@test.com", role: "teamMember" }), headers: new Headers() } as Response);
    await expect(fetchCurrentUser()).resolves.toMatchObject({ id: 1, name: "Updated User" });
  });

  it("no raw token is persisted in localStorage by the auth flow", async () => {
    localStorage.clear();
    await fetchCurrentUser();
    expect(localStorage.getItem("ghe.auth.token")).toBeNull();
  });

  it("only admin can access admin screens", () => {
    const admin = { role: "admin" } as never;
    const approver = { role: "approver" } as never;
    const member = { role: "teamMember" } as never;
    expect(canAccessScreen(admin, "admin-users")).toBe(true);
    expect(canAccessScreen(approver, "admin-users")).toBe(false);
    expect(canAccessScreen(member, "admin-users")).toBe(false);
    expect(canAccessScreen(null, "admin-users")).toBe(false);
  });

  it("approver can access approval queue", () => {
    const approver = { role: "approver" } as never;
    const member = { role: "teamMember" } as never;
    expect(canAccessScreen(approver, "approval-queue")).toBe(true);
    expect(canAccessScreen(member, "approval-queue")).toBe(false);
  });

  it("any authenticated role can access new-declaration", () => {
    const member = { role: "teamMember" } as never;
    const approver = { role: "approver" } as never;
    expect(canAccessScreen(member, "new-declaration")).toBe(true);
    expect(canAccessScreen(approver, "new-declaration")).toBe(true);
  });

  it("unauthenticated users can only reach landing/login", () => {
    expect(canAccessScreen(null, "landing")).toBe(true);
    expect(canAccessScreen(null, "login")).toBe(true);
    expect(canAccessScreen(null, "new-declaration")).toBe(false);
  });
});
