import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiClientError, setToken, clearToken } from "../services/httpClient";
import {
  fetchDeclarations, fetchDeclarationById, createDeclaration,
  fetchDashboardStats, fetchUsers,
} from "../services/api";
import { Declaration } from "../types/declaration";

beforeEach(() => {
  clearToken();
  vi.restoreAllMocks();
});

function mockFetch(status: number, body: unknown, headers?: Record<string, string>) {
  const blob = typeof body === "string" ? body : JSON.stringify(body);
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers ?? { "content-type": "application/json" }),
    json: () => (typeof body === "string" ? Promise.reject(new Error("not json")) : Promise.resolve(body)),
    text: () => Promise.resolve(blob),
  } as Response);
}

describe("httpClient — api.get", () => {
  it("returns JSON on 200", async () => {
    mockFetch(200, { id: "1", name: "test" });
    const data = await api.get<{ id: string }>("/api/test");
    expect(data).toEqual({ id: "1", name: "test" });
  });

  it("throws ApiClientError on 401", async () => {
    mockFetch(401, { error: "Unauthorized" });
    await expect(api.get("/api/test")).rejects.toThrow(ApiClientError);
    await expect(api.get("/api/test")).rejects.toThrow("Unauthorized");
  });

  it("throws ApiClientError on 403", async () => {
    mockFetch(403, { error: "Forbidden" });
    await expect(api.get("/api/test")).rejects.toThrow(ApiClientError);
  });

  it("throws ApiClientError on 404", async () => {
    mockFetch(404, { error: "Not found" });
    await expect(api.get("/api/test")).rejects.toThrow(ApiClientError);
  });

  it("throws ApiClientError on 500", async () => {
    mockFetch(500, { error: "Server error" });
    await expect(api.get("/api/test")).rejects.toThrow(ApiClientError);
  });

  it("throws with fallback message when error body lacks 'error' field", async () => {
    mockFetch(400, { message: "Bad request" });
    await expect(api.get("/api/test")).rejects.toThrow("Request failed with status 400");
  });

  it("throws when error body is not valid JSON", async () => {
    mockFetch(502, "Bad Gateway");
    await expect(api.get("/api/test")).rejects.toThrow("Request failed with status 502");
  });

  it("returns undefined on 204", async () => {
    mockFetch(204, undefined);
    const data = await api.get("/api/void");
    expect(data).toBeUndefined();
  });

  it("throws ApiClientError on network failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.get("/api/test")).rejects.toThrow(TypeError);
  });

  it("throws on malformed JSON response", async () => {
    mockFetch(200, "not json{{{");
    await expect(api.get("/api/test")).rejects.toThrow();
  });

  it("sets Authorization header when token exists", async () => {
    setToken("my-secret-token");
    let capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, opts: any) => {
      capturedHeaders = opts.headers ?? {};
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.get("/api/test");
    expect(capturedHeaders["Authorization"]).toBe("Bearer my-secret-token");
  });

  it("omits Authorization header when no token", async () => {
    let capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, opts: any) => {
      capturedHeaders = opts.headers ?? {};
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.get("/api/test");
    expect(capturedHeaders["Authorization"]).toBeUndefined();
  });

  it("sends Content-Type: application/json", async () => {
    let capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_, opts: any) => {
      capturedHeaders = opts.headers ?? {};
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.get("/api/test");
    expect(capturedHeaders["Content-Type"]).toBe("application/json");
  });
});

describe("httpClient — api.post", () => {
  it("sends JSON body", async () => {
    let capturedBody: string | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 201, json: () => Promise.resolve({ id: 1 }), headers: new Headers() } as Response;
    });
    const data = await api.post("/api/test", { name: "hello" });
    expect(capturedBody).toBe(JSON.stringify({ name: "hello" }));
    expect(data).toEqual({ id: 1 });
  });

  it("sends without body", async () => {
    let capturedBody: string | undefined;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_: string, opts: any) => {
      capturedBody = opts.body;
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.post("/api/test");
    expect(capturedBody).toBeUndefined();
  });
});

describe("httpClient — api.put, api.patch, api.del", () => {
  it("api.put sends PUT with body", async () => {
    let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.put("/api/test/1", { name: "updated" });
    expect(capturedMethod).toBe("PUT");
  });

  it("api.patch sends PATCH with body", async () => {
    let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 200, json: () => Promise.resolve({}), headers: new Headers() } as Response;
    });
    await api.patch("/api/test/1", { status: "Approved" });
    expect(capturedMethod).toBe("PATCH");
  });

  it("api.del sends DELETE", async () => {
    let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (_: string, opts: any) => {
      capturedMethod = opts.method;
      return { ok: true, status: 204, json: () => Promise.resolve(undefined), headers: new Headers() } as Response;
    });
    await api.del("/api/test/1");
    expect(capturedMethod).toBe("DELETE");
  });
});

describe("api.ts — high-level wrappers", () => {
  it("fetchDeclarations builds correct URL with no params", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]), headers: new Headers() } as Response;
    });
    await fetchDeclarations();
    expect(capturedUrl).toBe("/api/declarations");
  });

  it("fetchDeclarations passes status and search params", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]), headers: new Headers() } as Response;
    });
    await fetchDeclarations("Pending", "test");
    expect(capturedUrl).toContain("status=Pending");
    expect(capturedUrl).toContain("search=test");
  });

  it("fetchDeclarationById builds correct URL", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({
        id: "D-001", employee: "x", employeeId: "u1",
        type: "Gift", value: 100, status: "Draft",
      }), headers: new Headers() } as Response;
    });
    const dec = await fetchDeclarationById("D-001");
    expect(capturedUrl).toBe("/api/declarations/D-001");
    expect(dec.id).toBe("D-001");
  });

  it("createDeclaration sends via POST", async () => {
    let capturedUrl = ""; let capturedMethod = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string, opts: any) => {
      capturedUrl = url; capturedMethod = opts.method;
      return { ok: true, status: 201, json: () => Promise.resolve({
        id: "D-NEW", employee: "x", employeeId: "u1",
        type: "Gift", value: 100, status: "Draft",
      }), headers: new Headers() } as Response;
    });
    const dec = await createDeclaration({ employee: "x" } as Declaration);
    expect(capturedUrl).toBe("/api/declarations");
    expect(capturedMethod).toBe("POST");
  });

  it("fetchDashboardStats builds correct URL", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve({ kpis: {}, complianceTrend: [], typeBreakdown: [] }), headers: new Headers() } as Response;
    });
    await fetchDashboardStats();
    expect(capturedUrl).toBe("/api/declarations/stats");
  });

  it("fetchUsers builds URL with params", async () => {
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url: string) => {
      capturedUrl = url;
      return { ok: true, status: 200, json: () => Promise.resolve([]), headers: new Headers() } as Response;
    });
    await fetchUsers("sipho", "approver");
    expect(capturedUrl).toContain("search=sipho");
    expect(capturedUrl).toContain("role=approver");
  });

  it("propagates HTTP 403 from httpClient", async () => {
    mockFetch(403, { error: "Forbidden" });
    await expect(fetchDeclarationById("D-001")).rejects.toThrow(ApiClientError);
  });

  it("handles empty response array", async () => {
    mockFetch(200, []);
    const decs = await fetchDeclarations();
    expect(decs).toEqual([]);
  });
});

describe("httpClient — edge inputs", () => {
  it("handles paths with special characters", async () => {
    mockFetch(200, {});
    await expect(api.get("/api/test/path%20with%20spaces")).resolves.toBeDefined();
  });

  it("handles very long paths", async () => {
    const longPath = "/api/" + "x".repeat(5000);
    mockFetch(200, {});
    await expect(api.get(longPath)).resolves.toBeDefined();
  });

  it("handles null body in POST", async () => {
    mockFetch(201, { id: 1 });
    const data = await api.post("/api/test", null);
    expect(data).toEqual({ id: 1 });
  });

  it("handles response with unexpected schema gracefully", async () => {
    mockFetch(200, { unexpected: "shape", nested: [1, 2, 3] });
    const data = await api.get<Record<string, unknown>>("/api/test");
    expect(data).toBeDefined();
    expect(data.unexpected).toBe("shape");
  });

  it("throws on server returning HTML", async () => {
    mockFetch(200, "<html>Server Error</html>");
    await expect(api.get("/api/test")).rejects.toThrow();
  });
});
