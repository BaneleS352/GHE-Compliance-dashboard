import { toDbId } from "./ids";

interface ScopedCaller {
  role: string;
  organizationId?: number | bigint | null;
  department?: string | null;
  position?: string | null;
}

/** Organization isolation for routes that allow owners or workflow assignees. */
export function isOutsideOrganizationScope(
  caller: ScopedCaller,
  declarationOrganizationId: bigint | null,
): boolean {
  const callerOrganizationId = caller.organizationId ?? null;
  return caller.role !== "admin" && callerOrganizationId !== null && declarationOrganizationId !== null &&
    declarationOrganizationId !== toDbId(callerOrganizationId);
}

/** Snapshot-based department restriction for line-manager direct-ID access. */
export function isCrossDepartmentLineManager(
  caller: ScopedCaller,
  snapshotDepartment: string | null | undefined,
): boolean {
  return caller.role === "approver" && caller.position === "Line Manager" && Boolean(caller.department) &&
    snapshotDepartment !== caller.department;
}
