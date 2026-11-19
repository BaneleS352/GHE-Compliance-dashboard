import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  migrateLocalAttachments,
  type LegacyAttachmentMigrationDependencies,
  type LegacyAttachmentRecord,
} from "../services/legacyAttachmentMigration";

const temporaryDirectories: string[] = [];
const testReference = `azurite:${"b".repeat(32)}`;

async function createUploadsDirectory(): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ghe-attachment-migration-"));
  temporaryDirectories.push(directory);
  return directory;
}

function createDependencies(
  files: LegacyAttachmentRecord[],
  overrides: Partial<LegacyAttachmentMigrationDependencies> = {},
): LegacyAttachmentMigrationDependencies {
  return {
    listFiles: async () => files,
    updateReference: async (record, newReference) => {
      const current = files.find((file) => file.id === record.id);
      if (!current || current.storageReference !== record.storageReference) return false;
      current.storageReference = newReference;
      return true;
    },
    copyToAzurite: async () => testReference,
    deleteFromAzurite: async () => undefined,
    isAzuriteReference: (reference) => /^azurite:[a-f0-9]{32}$/.test(reference),
    ...overrides,
  };
}

function quietLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    fs.rm(directory, { recursive: true, force: true }),
  ));
});

describe("legacy attachment migration", () => {
  it("uploads first, updates the reference second, and preserves the source file", async () => {
    const uploadsDirectory = await createUploadsDirectory();
    const legacyName = `${"a".repeat(32)}.txt`;
    const sourcePath = path.join(uploadsDirectory, legacyName);
    const contents = Buffer.from("preserve this source attachment");
    await fs.writeFile(sourcePath, contents);
    const file: LegacyAttachmentRecord = { id: 1n, storageReference: legacyName, mimeType: "text/plain", size: contents.length };
    const events: string[] = [];
    const dependencies = createDependencies([file], {
      copyToAzurite: async (bytes, mimeType) => {
        expect(bytes).toEqual(contents);
        expect(mimeType).toBe("text/plain");
        events.push("uploaded");
        return testReference;
      },
      updateReference: async (record, reference) => {
        events.push("database-updated");
        record.storageReference = reference;
        return true;
      },
    });

    const result = await migrateLocalAttachments(uploadsDirectory, dependencies, quietLogger());

    expect(result).toEqual({ migrated: 1, skipped: 0, failed: 0 });
    expect(events).toEqual(["uploaded", "database-updated"]);
    expect(file.storageReference).toBe(testReference);
    await expect(fs.readFile(sourcePath)).resolves.toEqual(contents);
  });

  it("rejects traversal or arbitrary references without reading or uploading them", async () => {
    const uploadsDirectory = await createUploadsDirectory();
    const file: LegacyAttachmentRecord = { id: 2n, storageReference: "../../secrets.txt", mimeType: "text/plain", size: 1 };
    const copyToAzurite = vi.fn(async () => testReference);
    const updateReference = vi.fn(async () => true);

    const result = await migrateLocalAttachments(
      uploadsDirectory,
      createDependencies([file], { copyToAzurite, updateReference }),
      quietLogger(),
    );

    expect(result).toEqual({ migrated: 0, skipped: 0, failed: 1 });
    expect(copyToAzurite).not.toHaveBeenCalled();
    expect(updateReference).not.toHaveBeenCalled();
    expect(file.storageReference).toBe("../../secrets.txt");
  });

  it("leaves the database row unchanged when the source file is missing or its size differs", async () => {
    const uploadsDirectory = await createUploadsDirectory();
    const missing: LegacyAttachmentRecord = { id: 3n, storageReference: `${"c".repeat(32)}.txt`, mimeType: "text/plain", size: 2 };
    const mismatchName = `${"d".repeat(32)}.txt`;
    await fs.writeFile(path.join(uploadsDirectory, mismatchName), "actual");
    const mismatch: LegacyAttachmentRecord = { id: 4n, storageReference: mismatchName, mimeType: "text/plain", size: 99 };
    const copyToAzurite = vi.fn(async () => testReference);
    const records = [missing, mismatch];

    const result = await migrateLocalAttachments(
      uploadsDirectory,
      createDependencies(records, { copyToAzurite }),
      quietLogger(),
    );

    expect(result).toEqual({ migrated: 0, skipped: 0, failed: 2 });
    expect(copyToAzurite).not.toHaveBeenCalled();
    expect(missing.storageReference).toContain("c".repeat(32));
    expect(mismatch.storageReference).toBe(mismatchName);
  });

  it("deletes the copied blob when a conditional database update finds a changed row", async () => {
    const uploadsDirectory = await createUploadsDirectory();
    const name = `${"e".repeat(32)}.txt`;
    const sourcePath = path.join(uploadsDirectory, name);
    await fs.writeFile(sourcePath, "contents");
    const file: LegacyAttachmentRecord = { id: 5n, storageReference: name, mimeType: "text/plain", size: 8 };
    const deleteFromAzurite = vi.fn(async () => undefined);

    const result = await migrateLocalAttachments(
      uploadsDirectory,
      createDependencies([file], {
        updateReference: async () => false,
        deleteFromAzurite,
      }),
      quietLogger(),
    );

    expect(result).toEqual({ migrated: 0, skipped: 1, failed: 0 });
    expect(deleteFromAzurite).toHaveBeenCalledWith(testReference);
    expect(file.storageReference).toBe(name);
    await expect(fs.readFile(sourcePath, "utf8")).resolves.toBe("contents");
  });

  it("keeps a copied blob if the database update outcome is ambiguous", async () => {
    const uploadsDirectory = await createUploadsDirectory();
    const name = `${"f".repeat(32)}.txt`;
    await fs.writeFile(path.join(uploadsDirectory, name), "contents");
    const file: LegacyAttachmentRecord = { id: 6n, storageReference: name, mimeType: "text/plain", size: 8 };
    const deleteFromAzurite = vi.fn(async () => undefined);

    const result = await migrateLocalAttachments(
      uploadsDirectory,
      createDependencies([file], {
        updateReference: async () => { throw new Error("connection lost"); },
        deleteFromAzurite,
      }),
      quietLogger(),
    );

    expect(result).toEqual({ migrated: 0, skipped: 0, failed: 1 });
    expect(deleteFromAzurite).not.toHaveBeenCalled();
    expect(file.storageReference).toBe(name);
  });
});
