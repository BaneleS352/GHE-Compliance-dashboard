import type { Response } from "express";
import { requestIdFor } from "./requestContext";

/** Auth diagnostics deliberately exclude bearer tokens, claims, identifiers and raw errors. */
export function logAuthDiagnostic(res: Response, stage: string, outcome: "failure" | "success", reason?: string): void {
  console.info(JSON.stringify({
    event: "oidc_auth",
    requestId: requestIdFor(res),
    stage,
    outcome,
    ...(reason ? { reason } : {}),
  }));
}
