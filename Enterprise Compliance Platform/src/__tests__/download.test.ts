import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadFile, previewFile, requestProtectedDocument } from "../services/download";
import { getApiToken } from "../app/auth/msal";

vi.mock("../app/auth/msal", () => ({
  activeAccount: vi.fn(() => null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  getApiToken: vi.fn(() => Promise.resolve("test-token")),
  initializeIdentity: vi.fn(),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(getApiToken).mockResolvedValue("test-token");
});

function mockBlobFetch(status: number) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(new Blob(["data"], { type: "application/pdf" }), { status }),
  );
}

describe("shared download service", () => {
  it("sends the bearer token and triggers an anchor download", async () => {
    mockBlobFetch(200);
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    await downloadFile("/api/files/1", "doc.pdf");

    const options = vi.mocked(globalThis.fetch).mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get("Authorization")).toBe("Bearer test-token");
    expect(click).toHaveBeenCalledTimes(1);
    appendChild.mockRestore();
    removeChild.mockRestore();
    anchorClick.mockRestore();
  });

  it("throws a user-facing error on server failure", async () => {
    mockBlobFetch(500);
    await expect(downloadFile("/api/files/1", "doc.pdf")).rejects.toThrow(/Download failed/);
  });

  it("previews through a blob URL instead of the raw link", async () => {
    mockBlobFetch(200);
    const createObjectURL = vi.fn(() => "blob:mock");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await previewFile("/api/files/1");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(windowOpen).toHaveBeenCalledWith("blob:mock", "_blank", "noopener,noreferrer");
    windowOpen.mockRestore();
  });

  it("attaches the anchor before clicking for data URLs (Safari ignores detached clicks)", async () => {
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(document.body.contains(this)).toBe(true);
      click();
    });

    await downloadFile("data:text/plain,hi", "f.txt");

    expect(appendChild).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    appendChild.mockRestore();
    removeChild.mockRestore();
    anchorClick.mockRestore();
  });

  it("releases the preview URL on page hide instead of a fixed 30s timer", async () => {
    mockBlobFetch(200);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:mock"), revokeObjectURL });
    const windowOpen = vi.spyOn(window, "open").mockImplementation(() => null);

    await previewFile("/api/files/1");

    expect(revokeObjectURL).not.toHaveBeenCalled();
    window.dispatchEvent(new Event("pagehide"));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    windowOpen.mockRestore();
  });
});

describe("requestProtectedDocument", () => {
  async function mockProtectFetch(status: number, body: Blob | Record<string, string>) {
    const responseBody = body instanceof Blob ? await body.arrayBuffer() : JSON.stringify(body);
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(responseBody, {
      status,
      headers: {
        "Content-Disposition": 'attachment; filename="protected-r.xlsx"',
        "Content-Type": body instanceof Blob ? body.type : "application/json",
      },
    }));
  }

  it("posts the file, filename and password with auth, and returns protected bytes", async () => {
    const out = new Blob(["protected"], { type: "application/pdf" });
    const spy = await mockProtectFetch(200, out);
    const input = new Blob(["plain"], { type: "application/pdf" });

    const result = await requestProtectedDocument(input, "r.pdf", "s3cret-download-pw");

    expect(result.filename).toBe("protected-r.xlsx");
    expect(await result.blob.text()).toBe("protected");
    const [url, options] = spy.mock.calls[0] ?? [];
    if (!options) throw new Error("Expected protected-document request options");
    expect(url).toBe("/api/reports/protect-document");
    expect(options.method).toBe("POST");
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer test-token");
    if (!(options.body instanceof FormData)) throw new Error("Expected multipart form data");
    const form = options.body;
    expect(form.get("password")).toBe("s3cret-download-pw");
    expect(form.get("filename")).toBe("r.pdf");
    expect((form.get("file") as File).name).toBe("r.pdf");
  });

  it("reports unavailability explicitly on 503", async () => {
    await mockProtectFetch(503, { error: "unavailable" });
    await expect(
      requestProtectedDocument(new Blob(["x"]), "r.pdf", "s3cret-download-pw")
    ).rejects.toThrow(/unavailable on this server/);
  });

  it("surfaces server validation errors, never a silent fallback", async () => {
    await mockProtectFetch(400, { error: "Password must be at least 8 characters." });
    await expect(
      requestProtectedDocument(new Blob(["x"]), "r.pdf", "s3cret-download-pw")
    ).rejects.toThrow(/at least 8 characters/);
  });
});
