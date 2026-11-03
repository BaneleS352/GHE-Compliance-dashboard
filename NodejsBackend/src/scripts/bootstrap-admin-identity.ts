import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { config } from "../config/env";

const args = process.argv.slice(2);
const inputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email().transform((value) => value.toLowerCase()),
  subject: z.string().uuid().transform((value) => value.toLowerCase()),
  evidenceReference: z.string().trim().min(8).max(200),
  operatorLabel: z.string().trim().min(2).max(120),
});

async function main(): Promise<void> {
  const parsed = inputSchema.safeParse({
    name: args[0],
    email: args[1],
    subject: args[2],
    evidenceReference: args[3],
    operatorLabel: args[4],
  });
  if (!parsed.success) {
    throw new Error("Usage: npm run auth:bootstrap-admin -- <admin-name> <admin-email> <entra-oid> <evidence-reference> <operator-id>");
  }
  const { name, email, subject, evidenceReference, operatorLabel } = parsed.data;

  await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email }, select: { id: true, role: true, isActive: true } });
    if (!user) {
      user = await tx.user.create({ data: {
        name,
        email,
        role: "admin",
        teamMemberNumber: `BOOTSTRAP-${Date.now()}`,
        position: "System Administrator",
      }, select: { id: true, role: true, isActive: true } });
    }
    if (user.role !== "admin" || !user.isActive) {
      throw new Error("Bootstrap target must be an active local admin account; existing non-admin accounts are never promoted by this command");
    }
    const updated = await tx.user.updateMany({
      where: { id: user.id, providerSubject: null },
      data: { providerSubject: subject, providerIssuer: config.oidc.issuer },
    });
    if (updated.count !== 1) {
      throw new Error("Bootstrap admin already has a provider identity link; no changes were made");
    }
    await tx.identityLinkAudit.create({ data: {
      targetUserId: user.id,
      actorUserId: null,
      actorType: "bootstrap",
      actorLabel: operatorLabel,
      providerIssuer: config.oidc.issuer,
      providerSubject: subject,
      evidenceReference,
    } });
  });
  console.log(`Bootstrap admin identity created or linked for ${email}. Audit evidence: ${evidenceReference}.`);
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Provider identity is already linked to another user; no changes were made.");
    } else {
      console.error(error instanceof Error ? error.message : error);
    }
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
