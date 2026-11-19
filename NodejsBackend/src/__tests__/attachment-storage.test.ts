import { afterEach, describe, expect, it } from "vitest";
import {
  copyLegacyAttachmentToAzurite,
  createAzuriteContainerClient,
  deleteStoredAttachment,
  isAzuriteAttachment,
  readStoredAttachment,
} from "../services/attachmentStorage";

const createdReferences: string[] = [];

afterEach(async () => {
  await Promise.all(createdReferences.splice(0).map((reference) => deleteStoredAttachment(reference)));
});

describe("Azurite attachment storage", () => {
  it("creates a private container and round-trips a blob with its MIME type", async () => {
    const container = createAzuriteContainerClient();
    await container.createIfNotExists();
    const properties = await container.getProperties();
    expect(properties.blobPublicAccess).not.toBe("blob");
    expect(properties.blobPublicAccess).not.toBe("container");

    const contents = Buffer.from("Azurite attachment payload");
    const reference = await copyLegacyAttachmentToAzurite(contents, "text/plain");
    createdReferences.push(reference);

    expect(isAzuriteAttachment(reference)).toBe(true);
    await expect(readStoredAttachment(reference)).resolves.toEqual(contents);
    const blobName = reference.slice("azurite:".length);
    const blobProperties = await container.getBlobClient(blobName).getProperties();
    expect(blobProperties.contentType).toBe("text/plain");

    await deleteStoredAttachment(reference);
    createdReferences.splice(createdReferences.indexOf(reference), 1);
    await expect(readStoredAttachment(reference)).resolves.toBeNull();
  });

  it("fails closed for local paths and returns null for a missing Azurite blob", async () => {
    expect(isAzuriteAttachment("../../uploads/private.txt")).toBe(false);
    await expect(readStoredAttachment("../../uploads/private.txt")).resolves.toBeNull();
    await expect(deleteStoredAttachment("../../uploads/private.txt"))
      .rejects.toThrow("attachment_azurite_migration_required");
    await expect(readStoredAttachment("azurite:ffffffffffffffffffffffffffffffff"))
      .resolves.toBeNull();
  });
});
