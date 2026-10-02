import { getAuthToken } from "./httpClient";

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
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`Download failed (server responded ${response.status}). Please try again.`);
  }
  return response.blob();
}

function saveBlob(blob: Blob, filename: string): void {
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
