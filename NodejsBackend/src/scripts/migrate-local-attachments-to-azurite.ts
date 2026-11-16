import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../config/prisma";
import {
  copyLegacyAttachmentToAzurite,
  deleteStoredAttachment,
  isAzuriteAttachment,
} from "../services/attachmentStorage";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

/** Historical Multer names were random hex plus an extension. */
function containedLegacyUploadPath(storedPath: string): string | null {
  if (!/^[a-f0-9]{32}(?:\.[a-zA-Z0-9]{1,10})?$/.test(storedPath)) return null;
  const resolved = path.resolve(UPLOAD_DIR, storedPath);
  return resolved !== UPLOAD_DIR && resolved.startsWith(UPLOAD_DIR + path.sep) ? resolved : null;
}

async function main(): Promise<void> {
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const files = await prisma.uploadedFile.findMany({
      orderBy: { id: "asc" },
      select: { id: true, storageReference: true, mimeType: true, size: true },
    });
    const legacyFiles = files.filter((file) => !isAzuriteAttachment(file.storageReference));
    console.log(`[INFO] Found ${legacyFiles.length} attachment record(s) that are not stored in Azurite.`);

    for (const file of legacyFiles) {
      const localPath = containedLegacyUploadPath(file.storageReference);
      if (!localPath) {
        console.error(JSON.stringify({ event: "attachment_migration_failed", fileId: String(file.id), reason: "invalid_legacy_path" }));
        failed++;
        continue;
      }

      let reference: string | undefined;
      try {
        const [uploadsRoot, realFilePath, fileInfo] = await Promise.all([
          fs.realpath(UPLOAD_DIR),
          fs.realpath(localPath),
          fs.lstat(localPath),
        ]);
        const relativePath = path.relative(uploadsRoot, realFilePath);
        if (
          fileInfo.isSymbolicLink() ||
          !fileInfo.isFile() ||
          fileInfo.size > 10 * 1024 * 1024 ||
          fileInfo.size !== file.size ||
          relativePath.startsWith("..") ||
          path.isAbsolute(relativePath)
        ) {
          throw new Error("legacy_file_not_a_contained_regular_file");
        }
        const contents = await fs.readFile(realFilePath);
        if (contents.length !== file.size) throw new Error("legacy_file_size_changed_during_migration");
        reference = await copyLegacyAttachmentToAzurite(contents, file.mimeType);
        const updated = await prisma.uploadedFile.updateMany({
          where: { id: file.id, storageReference: file.storageReference },
          data: { storageReference: reference },
        });
        if (updated.count !== 1) {
          await deleteStoredAttachment(reference);
          console.warn(JSON.stringify({ event: "attachment_migration_skipped", fileId: String(file.id), reason: "record_changed_during_migration" }));
          skipped++;
          continue;
        }
        // The source file remains on disk as a recovery copy until an operator
        // verifies the migrated application and chooses to archive old data.
        console.info(JSON.stringify({ event: "attachment_migrated", fileId: String(file.id), size: contents.length }));
        migrated++;
      } catch (error) {
        if (reference) {
          try { await deleteStoredAttachment(reference); } catch { /* preserve original migration failure */ }
        }
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
          ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
          : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
        console.error(JSON.stringify({ event: "attachment_migration_failed", fileId: String(file.id), reason: code || "UnknownError" }));
        failed++;
      }
    }

    console.log(`[INFO] Azurite migration summary: migrated=${migrated}, skipped=${skipped}, failed=${failed}.`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
    : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
  console.error(`[FAIL] Attachment migration could not start (${code || "UnknownError"}).`);
  process.exitCode = 1;
});
