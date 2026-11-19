import fs from "node:fs/promises";
import path from "node:path";

export interface LegacyAttachmentRecord {
  id: bigint;
  storageReference: string;
  mimeType: string;
  size: number;
}

export interface LegacyAttachmentMigrationDependencies {
  listFiles(): Promise<LegacyAttachmentRecord[]>;
  updateReference(record: LegacyAttachmentRecord, newReference: string): Promise<boolean>;
  copyToAzurite(contents: Buffer, mimeType: string): Promise<string>;
  deleteFromAzurite(reference: string): Promise<void>;
  isAzuriteReference(reference: string): boolean;
}

export interface LegacyAttachmentMigrationResult {
  migrated: number;
  skipped: number;
  failed: number;
}

type MigrationLogger = Pick<Console, "info" | "warn" | "error">;

function containedLegacyUploadPath(uploadsDirectory: string, storedPath: string): string | null {
  // Historical Multer names were random hex plus the original extension.
  if (!/^[a-f0-9]{32}(?:\.[a-zA-Z0-9]{1,10})?$/.test(storedPath)) return null;
  const uploadsRoot = path.resolve(uploadsDirectory);
  const resolved = path.resolve(uploadsRoot, storedPath);
  return resolved !== uploadsRoot && resolved.startsWith(uploadsRoot + path.sep) ? resolved : null;
}

function safeErrorCode(error: unknown): string {
  const value = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : error instanceof Error ? error.name : "UnknownError";
  return value.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "UnknownError";
}

/** Copy referenced legacy uploads into Azurite without deleting their source files. */
export async function migrateLocalAttachments(
  uploadsDirectory: string,
  dependencies: LegacyAttachmentMigrationDependencies,
  logger: MigrationLogger = console,
): Promise<LegacyAttachmentMigrationResult> {
  const result: LegacyAttachmentMigrationResult = { migrated: 0, skipped: 0, failed: 0 };
  const files = await dependencies.listFiles();
  const legacyFiles = files.filter((file) => !dependencies.isAzuriteReference(file.storageReference));
  logger.info(`[INFO] Found ${legacyFiles.length} attachment record(s) that are not stored in Azurite.`);

  for (const file of legacyFiles) {
    const localPath = containedLegacyUploadPath(uploadsDirectory, file.storageReference);
    if (!localPath) {
      logger.error(JSON.stringify({ event: "attachment_migration_failed", fileId: String(file.id), reason: "invalid_legacy_path" }));
      result.failed++;
      continue;
    }

    let reference: string | undefined;
    try {
      const [uploadsRoot, realFilePath, fileInfo] = await Promise.all([
        fs.realpath(uploadsDirectory),
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
      reference = await dependencies.copyToAzurite(contents, file.mimeType);
      let referenceUpdated: boolean;
      try {
        referenceUpdated = await dependencies.updateReference(file, reference);
      } catch (error) {
        // The database may have committed before a network error reached us.
        // Keep the blob on ambiguous outcomes so a committed row never points
        // to deleted bytes; a harmless orphan can be reconciled later.
        reference = undefined;
        throw error;
      }
      if (!referenceUpdated) {
        await dependencies.deleteFromAzurite(reference);
        reference = undefined;
        logger.warn(JSON.stringify({ event: "attachment_migration_skipped", fileId: String(file.id), reason: "record_changed_during_migration" }));
        result.skipped++;
        continue;
      }

      // Keep the source file as a recovery copy after changing the DB reference.
      reference = undefined;
      logger.info(JSON.stringify({ event: "attachment_migrated", fileId: String(file.id), size: contents.length }));
      result.migrated++;
    } catch (error) {
      if (reference) {
        try { await dependencies.deleteFromAzurite(reference); } catch { /* preserve original migration failure */ }
      }
      logger.error(JSON.stringify({ event: "attachment_migration_failed", fileId: String(file.id), reason: safeErrorCode(error) }));
      result.failed++;
    }
  }

  logger.info(`[INFO] Azurite migration summary: migrated=${result.migrated}, skipped=${result.skipped}, failed=${result.failed}.`);
  return result;
}
