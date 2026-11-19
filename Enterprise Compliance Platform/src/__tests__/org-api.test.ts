import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOrganizations, fetchManagers, fetchDepartments, fetchAdminOrganizations } from "../services/api";
import { getApiToken } from "../app/auth/msal";

vi.mock("../app/auth/msal", () => ({
  getApiToken: vi.fn(() => Promise.resolve("test-token")),
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  initializeIdentity: vi.fn(),
}));

function mockFetch(status: number, body: unknown) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  }));
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(getApiToken).mockResolvedValue("test-token");
});

describe("Organization API — per-org", () => {
  it("sends the MSAL bearer token on API calls", async () => {
    const spy = mockFetch(200, []);
    await fetchOrganizations();
    const options = spy.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(getApiToken).toHaveBeenCalled();
  });

  it("fetchOrganizations returns 2 orgs", async () => {
    const spy = mockFetch(200, [{ id: 1, name: "HB", shortCode: "HB" }, { id: 2, name: "NPN", shortCode: "NPN" }]);
    const orgs = await fetchOrganizations();
    expect(orgs.length).toBe(2);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/users/organizations"), expect.any(Object));
  });

  it("fetchManagers with orgId filters", async () => {
    const spy = mockFetch(200, [{ id: "m-hb", name: "Sipho" }]);
    await fetchManagers(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=1"), expect.any(Object));
  });

  it("fetchDepartments per org", async () => {
    const spy = mockFetch(200, ["Marketing", "Sales"]);
    const depts = await fetchDepartments(1);
    expect(depts).toContain("Marketing");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=1"), expect.any(Object));
  });

  it("fetchAdminOrganizations admin only", async () => {
    const spy = mockFetch(200, [{ id: 1, name: "HB" }]);
    const orgs = await fetchAdminOrganizations();
    expect(orgs.length).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/admin/config/organizations"), expect.any(Object));
  });

  it("forwards cancellation to admin organization lookups", async () => {
    const spy = mockFetch(200, []);
    const controller = new AbortController();
    await fetchAdminOrganizations({ signal: controller.signal });
    const forwardedSignal = spy.mock.calls[0]?.[1]?.signal;
    if (!forwardedSignal) throw new Error("Expected admin organization lookup to receive a cancellation signal");
    expect(forwardedSignal).not.toBe(controller.signal);
    controller.abort();
    expect(forwardedSignal.aborted).toBe(true);
  });
});
