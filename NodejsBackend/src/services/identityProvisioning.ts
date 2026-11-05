import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";

export interface BootstrapAdminIdentityInput {
  name: string;
  email: string;
  providerSubject: string;
  providerIssuer: string;
  evidenceReference: string;
  operatorLabel: string;
}

/**
 * One-time database-operator bootstrap for the first administrator. The
 * operation creates no role promotion: an existing non-admin account is
 * rejected, while a missing account is created explicitly as the initial
 * admin. Identity, role, and audit event commit atomically.
 */
export async function bootstrapAdminIdentity(prisma: PrismaClient, input: BootstrapAdminIdentityInput): Promise<{ id: bigint; email: string }> {
  return prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email: input.email }, select: { id: true, role: true, isActive: true } });
    if (user && (user.role !== "admin" || !user.isActive)) {
      throw new Error("Bootstrap target must be an active local admin account; existing non-admin accounts are never promoted by this command");
    }
    if (!user) {
      user = await tx.user.create({ data: {
        name: input.name,
        email: input.email,
        role: "admin",
        teamMemberNumber: `BOOTSTRAP-${randomUUID()}`,
        position: "System Administrator",
      }, select: { id: true, role: true, isActive: true } });
    }

    const linked = await tx.user.updateMany({
      where: { id: user.id, providerSubject: null },
      data: { providerSubject: input.providerSubject, providerIssuer: input.providerIssuer },
    });
    if (linked.count !== 1) {
      throw new Error("Bootstrap admin already has a provider identity link; no changes were made");
    }
    await tx.identityLinkAudit.create({ data: {
      targetUserId: user.id,
      actorUserId: null,
      actorType: "bootstrap",
      actorLabel: input.operatorLabel,
      providerIssuer: input.providerIssuer,
      providerSubject: input.providerSubject,
      evidenceReference: input.evidenceReference,
    } });
    return { id: user.id, email: input.email };
  });
}
