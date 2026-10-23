export interface ClientErrorContext {
  feature: string;
  operation: string;
  status?: number;
}

interface SafeClientError {
  name: string;
}

function normalizeClientError(error: unknown): SafeClientError {
  if (error instanceof Error) {
    return { name: error.name };
  }

  return { name: "UnknownError" };
}

/**
 * Central client-side error reporting seam. The event is intentionally
 * provider-neutral so the host can connect it to approved telemetry later.
 * Raw response bodies and tokens are never included in the payload.
 */
export function reportClientError(error: unknown, context: ClientErrorContext): void {
  const normalized = normalizeClientError(error);
  const detail = { ...context, ...normalized };

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ghe:client-error", { detail }));
  }

  if (import.meta.env.DEV) {
    console.error("[client-error]", detail);
  }
}

