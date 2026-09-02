import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchOrganizations, fetchManagers, fetchDepartments, fetchAdminOrganizations } from "../services/api";
import { setToken, clearToken } from "../services/httpClient";

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
  clearToken();
  setToken("test-token");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Organization API — per-org", () => {
  it("fetchOrganizations returns 2 orgs", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: "org-1", name: "HB", shortCode: "HB" }, { id: "org-2", name: "NPN", shortCode: "NPN" }]) as any);
    const orgs = await fetchOrganizations();
    expect(orgs.length).toBe(2);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/users/organizations"), expect.any(Object));
  });

  it("fetchManagers with orgId filters", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: "m-hb", name: "Sipho" }]) as any);
    await fetchManagers("org-1");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=org-1"), expect.any(Object));
  });

  it("fetchDepartments per org", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, ["Marketing", "Sales"]) as any);
    const depts = await fetchDepartments("org-1");
    expect(depts).toContain("Marketing");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("organizationId=org-1"), expect.any(Object));
  });

  it("fetchAdminOrganizations admin only", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(mockFetch(200, [{ id: "org-1", name: "HB" }]) as any);
    const orgs = await fetchAdminOrganizations();
    expect(orgs.length).toBe(1);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("/api/admin/config/organizations"), expect.any(Object));
  });
});
