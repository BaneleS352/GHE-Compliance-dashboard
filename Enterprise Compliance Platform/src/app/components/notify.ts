import { toast } from "sonner";

/**
 * Shared operation-level notification interface (Phase 3).
 *
 * Inline field validation stays in forms; these are for operation outcomes:
 * create/update/delete, workflow decisions, uploads, downloads, exports.
 * Keep messages short, specific, and actionable (include retry guidance
 * where the user can act on the failure).
 */
export function notifySuccess(message: string): void {
  toast.success(message);
}

export function notifyError(message: string): void {
  toast.error(message);
}
