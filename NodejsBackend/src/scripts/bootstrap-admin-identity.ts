import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { config } from "../config/env";
import { bootstrapAdminIdentity } from "../services/identityProvisioning";

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
  await bootstrapAdminIdentity(prisma, {
    name,
    email,
    providerSubject: subject,
    providerIssuer: config.oidc.issuer,
    evidenceReference,
    operatorLabel,
  });
  console.log(JSON.stringify({ event: "identity_bootstrap_succeeded" }));
}

main()
  .catch((error: unknown) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Provider identity is already linked to another user; no changes were made.");
    } else {
      const errorName = error && typeof error === "object" && "name" in error && typeof error.name === "string"
        ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "Error"
        : "UnknownError";
      console.error(JSON.stringify({ event: "identity_bootstrap_failed", errorName }));
    }
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
