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

function mockFetch(status: number, body: any) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => "application/json" },
      text: () => Promise.resolve(JSON.stringify(body)),
      json: () => Promise.resolve(body),
    } as any)
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(getApiToken).mockResolvedValue("test-token");
});

describe("Organization API — per-org", () => {
  it("sends the MSAL bearer token on API calls", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [])) as any;
    await fetchOrganizations();
    const [, options] = spy.mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(getApiToken).toHaveBeenCalled();
  });

  it("fetchOrganizations returns 2 orgs", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: 1, name: "HB", shortCode: "HB" }, { id: 2, name: "NPN", shortCode: "NPN" }]) as any);
    const orgs = await fetchOrganizations();
    expect(orgs.length).toBe(2);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/users/organizations"), expect.any(Object));
  });

  it("fetchManagers with orgId filters", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: "m-hb", name: "Sipho" }]) as any);
    await fetchManagers(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=1"), expect.any(Object));
  });

  it("fetchDepartments per org", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, ["Marketing", "Sales"]) as any);
    const depts = await fetchDepartments(1);
    expect(depts).toContain("Marketing");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=1"), expect.any(Object));
  });

  it("fetchAdminOrganizations admin only", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: 1, name: "HB" }]) as any);
    const orgs = await fetchAdminOrganizations();
    expect(orgs.length).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/admin/config/organizations"), expect.any(Object));
  });
});
