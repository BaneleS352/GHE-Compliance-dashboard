import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadFile, previewFile } from "../services/download";
import { setToken, clearToken } from "../services/httpClient";

beforeEach(() => {
  clearToken();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function mockBlobFetch(status: number) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    blob: () => Promise.resolve(new Blob(["data"], { type: "application/pdf" })),
  } as any);
}

describe("shared download service", () => {
  it("sends the bearer token and triggers an anchor download", async () => {
    setToken("test-token");
    mockBlobFetch(200);
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, "appendChild").mockImplementation(((node: any) => { node.click = click; return node; }) as any);
    const removeChild = vi.spyOn(document.body, "removeChild").mockImplementation(((node: any) => node) as any);
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    await downloadFile("/api/files/1", "doc.pdf");

    const [, options] = (globalThis.fetch as any).mock.calls[0];
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(click).toHaveBeenCalledTimes(1);
    appendChild.mockRestore();
    removeChild.mockRestore();
  });

  it("throws a user-facing error on server failure", async () => {
    setToken("test-token");
    mockBlobFetch(500);
    await expect(downloadFile("/api/files/1", "doc.pdf")).rejects.toThrow(/Download failed/);
  });

  it("previews through a blob URL instead of the raw link", async () => {
    setToken("test-token");
    mockBlobFetch(200);
    const createObjectURL = vi.fn(() => "blob:mock");
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL: vi.fn() });
    const windowOpen = vi.spyOn(window, "open").mockImplementation((() => null) as any);

    await previewFile("/api/files/1");

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(windowOpen).toHaveBeenCalledWith("blob:mock", "_blank", "noopener,noreferrer");
    windowOpen.mockRestore();
  });
});
