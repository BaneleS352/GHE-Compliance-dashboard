import { prisma } from "../config/prisma";

/**
 * Organization consistency invariant (service-level).
 *
 * Rule: whenever a row carries an `organizationId` AND references an
 * organization-scoped row, both organizations must match. A `NULL`
 * (global/unscoped) value on either side is always allowed — global HR,
 * global counterparties, and unscoped declarations are legitimate.
 *
 * This is enforced here, at the write boundary, because route-level query
 * filters alone cannot prevent a cross-organization reference from being
 * stored. Database composite foreign keys remain impractical while the
 * organization links stay nullable by design, so this module is the single
 * tested enforcement point (see organization multi-tenant negative tests).
 *
 * Returns an error message when the invariant is violated, otherwise null.
 */
export async function managerOrgViolation(
  managerId: bigint | null,
  organizationId: bigint | null,
): Promise<string | null> {
  if (managerId === null || organizationId === null) return null;
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { organizationId: true, name: true },
  });
  if (!manager || manager.organizationId === null) return null;
  if (manager.organizationId !== organizationId) {
    return `Manager "${manager.name}" belongs to another organization`;
  }
  return null;
}
