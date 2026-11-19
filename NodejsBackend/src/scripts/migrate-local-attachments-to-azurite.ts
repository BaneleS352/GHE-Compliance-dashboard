import "dotenv/config";
import path from "node:path";
import { prisma } from "../config/prisma";
import {
  copyLegacyAttachmentToAzurite,
  deleteStoredAttachment,
  isAzuriteAttachment,
} from "../services/attachmentStorage";
import { migrateLocalAttachments } from "../services/legacyAttachmentMigration";

async function main(): Promise<void> {
  try {
    const result = await migrateLocalAttachments(path.resolve(process.cwd(), "uploads"), {
      listFiles: () => prisma.uploadedFile.findMany({
        orderBy: { id: "asc" },
        select: { id: true, storageReference: true, mimeType: true, size: true },
      }),
      updateReference: async (file, newReference) => {
        const updated = await prisma.uploadedFile.updateMany({
          where: { id: file.id, storageReference: file.storageReference },
          data: { storageReference: newReference },
        });
        return updated.count === 1;
      },
      copyToAzurite: copyLegacyAttachmentToAzurite,
      deleteFromAzurite: deleteStoredAttachment,
      isAzuriteReference: isAzuriteAttachment,
    });
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function safeErrorCode(error: unknown): string {
  const value = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : error instanceof Error ? error.name : "UnknownError";
  return value.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "UnknownError";
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(`[FAIL] Attachment migration could not start (${safeErrorCode(error)}).`);
    process.exitCode = 1;
  });
}
