import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../config/prisma";

type CleanupDatabase = PrismaClient | Prisma.TransactionClient;

const AZURITE_REFERENCE = /^azurite:[a-f0-9]{32}$/;

/** Persist an idempotent deletion job, optionally in the caller's transaction. */
export async function enqueueAttachmentCleanup(db: CleanupDatabase, storageReference: string): Promise<void> {
  if (!AZURITE_REFERENCE.test(storageReference)) throw new Error("invalid_attachment_cleanup_reference");
  await db.attachmentCleanupOutbox.createMany({
    data: [{ storageReference }],
    skipDuplicates: true,
  });
}

/** Best-effort fallback for an upload that could not be rolled back in Azurite. */
export async function enqueueAttachmentCleanupAfterFailure(storageReference: string, stage: string): Promise<void> {
  try {
    await enqueueAttachmentCleanup(prisma, storageReference);
    console.warn(JSON.stringify({ event: "attachment_cleanup_queued", stage }));
  } catch (error) {
    console.error(JSON.stringify({
      event: "attachment_cleanup_queue_failed",
      stage,
      storageReference,
      errorName: safeErrorName(error),
    }));
  }
}

function safeErrorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "Error";
  }
  return "UnknownError";
}
