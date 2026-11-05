export interface ClientErrorContext {
  feature: string;
  operation: string;
  status?: number;
  requestId?: string;
}

interface SafeClientError {
  name: string;
  code?: string;
  providerCodes?: number[];
  correlationId?: string;
  subError?: string;
  identityStage?: string;
  configFingerprint?: string;
  requestedResourceMatch?: "matches_config" | "differs_from_config";
}

function normalizeClientError(error: unknown): SafeClientError {
  if (error instanceof Error) {
    const candidate = error as Error & {
      errorCode?: unknown;
      errorCodes?: unknown;
      correlationId?: unknown;
      subError?: unknown;
      identityStage?: unknown;
      configFingerprint?: unknown;
      requestedResourceMatch?: unknown;
    };
    const safeString = (value: unknown, max = 80): string | undefined =>
      typeof value === "string" && /^[a-zA-Z0-9_.-]+$/.test(value) ? value.slice(0, max) : undefined;
    const providerCodes = Array.isArray(candidate.errorCodes)
      ? candidate.errorCodes.filter((value): value is number => typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1000000).slice(0, 5)
      : undefined;
    const correlationId = typeof candidate.correlationId === "string" && /^[0-9a-f-]{36}$/i.test(candidate.correlationId)
      ? candidate.correlationId
      : undefined;
    return {
      name: safeString(error.name, 64) ?? "Error",
      ...(safeString(candidate.errorCode) ? { code: safeString(candidate.errorCode) } : {}),
      ...(providerCodes?.length ? { providerCodes } : {}),
      ...(correlationId ? { correlationId } : {}),
      ...(safeString(candidate.subError) ? { subError: safeString(candidate.subError) } : {}),
      ...(safeString(candidate.identityStage) ? { identityStage: safeString(candidate.identityStage) } : {}),
      ...(typeof candidate.configFingerprint === "string" && /^[0-9a-f]{16}$/i.test(candidate.configFingerprint) ? { configFingerprint: candidate.configFingerprint } : {}),
      ...(candidate.requestedResourceMatch === "matches_config" || candidate.requestedResourceMatch === "differs_from_config" ? { requestedResourceMatch: candidate.requestedResourceMatch } : {}),
    };
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

