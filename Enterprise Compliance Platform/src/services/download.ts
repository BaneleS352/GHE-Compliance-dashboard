import { getApiToken } from "@/app/auth/msal";

/**
 * Single authenticated download/preview service (Phase 6).
 *
 * All file downloads and previews go through here: one authorization path
 * (Bearer token), consistent filename handling, visible errors for the
 * caller to surface, and object URL cleanup. Direct anchors and ad hoc
 * `fetch()` calls must not create a second security path. Data URLs
 * (not-yet-uploaded local files) bypass authentication by nature.
 */
async function fetchBlob(url: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  headers["Authorization"] = `Bearer ${await getApiToken()}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Download failed (server responded ${response.status}). Please try again.`);
  }
  return response.blob();
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
}

export async function downloadFile(url: string, filename: string): Promise<void> {
  if (!url || url.startsWith("data:")) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    return;
  }
  saveBlob(await fetchBlob(url), filename);
}

export async function previewFile(url: string): Promise<void> {
  if (!url || url.startsWith("data:")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = await fetchBlob(url);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

/**
 * Password-protect one explicitly exported document (Phase 5).
 *
 * The caller builds the export bytes client-side (existing layout code),
 * collects a per-download password via PasswordDialog, and sends both to
 * POST /api/reports/protect-document. The password travels in the request
 * body only and is never stored. Returns the protected bytes for the caller
 * to save; throws a user-facing error otherwise — callers must never fall
 * back to saving the unprotected input.
 */
export async function requestProtectedDocument(
  input: Blob,
  filename: string,
  password: string,
): Promise<{ blob: Blob; filename: string }> {
  const form = new FormData();
  form.append("file", input, filename);
  form.append("password", password);
  form.append("filename", filename);
  const headers: Record<string, string> = {};
  headers["Authorization"] = `Bearer ${await getApiToken()}`;
  let response: Response;
  try {
    response = await fetch("/api/reports/protect-document", {
      method: "POST",
      headers,
      body: form,
    });
  } catch {
    throw new Error("Protection request failed. Check your connection and try again.");
  }
  if (!response.ok) {
    if (response.status === 503) {
      throw new Error("Password protection is unavailable on this server. No file was downloaded.");
    }
    let detail = "";
    try {
      detail = (await response.json())?.error || "";
    } catch { /* ignore parse errors */ }
    throw new Error(detail || `Protection failed (server responded ${response.status}). No file was downloaded.`);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = /filename="([^"]+)"/.exec(disposition);
  return { blob, filename: match ? match[1] : `protected-${filename}` };
}
