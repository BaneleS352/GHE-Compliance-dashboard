import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import crypto from "node:crypto";
import { attachmentStorageConfig } from "../config/attachmentStorage";

const AZURITE_PATH_PREFIX = "azurite:";

let cachedContainer: ContainerClient | undefined;
let cachedConnectionString: string | undefined;
let ensureContainerPromise: Promise<void> | undefined;

function getAzuriteContainer(): ContainerClient {
  const connectionString = attachmentStorageConfig.connectionString;
  if (!cachedContainer || cachedConnectionString !== connectionString) {
    cachedConnectionString = connectionString;
    cachedContainer = BlobServiceClient.fromConnectionString(connectionString)
      .getContainerClient(attachmentStorageConfig.container);
    ensureContainerPromise = undefined;
  }
  return cachedContainer;
}

export function createAzuriteContainerClient(): ContainerClient {
  return getAzuriteContainer();
}

async function ensureContainer(container: ContainerClient): Promise<void> {
  if (!ensureContainerPromise) {
    ensureContainerPromise = container.createIfNotExists().then(() => undefined).catch((error: unknown) => {
      ensureContainerPromise = undefined;
      throw error;
    });
  }
  await ensureContainerPromise;
}

function blobNameFromReference(storedReference: string): string | null {
  if (!storedReference.startsWith(AZURITE_PATH_PREFIX)) return null;
  const blobName = storedReference.slice(AZURITE_PATH_PREFIX.length);
  return /^[a-f0-9]{32}$/.test(blobName) ? blobName : "";
}

export function isAzuriteAttachment(storedReference: string): boolean {
  const blobName = blobNameFromReference(storedReference);
  return blobName !== null && blobName !== "";
}

async function uploadBufferToAzurite(contents: Buffer, mimeType: string): Promise<string> {
  const container = getAzuriteContainer();
  await ensureContainer(container);
  const blobName = crypto.randomBytes(16).toString("hex");
  try {
    await container.getBlockBlobClient(blobName).uploadData(contents, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });
    return `${AZURITE_PATH_PREFIX}${blobName}`;
  } catch (error) {
    try { await container.getBlobClient(blobName).deleteIfExists(); } catch { /* retain the original upload error */ }
    throw error;
  }
}

/** Store a multipart upload in Azurite and return its opaque DB reference. */
export async function storeUploadedAttachment(file: Express.Multer.File): Promise<string> {
  if (!file.buffer) throw new Error("attachment_upload_buffer_missing");
  return uploadBufferToAzurite(file.buffer, file.mimetype);
}

/** Used by the one-time local-disk migration; source files are never removed. */
export async function copyLegacyAttachmentToAzurite(contents: Buffer, mimeType: string): Promise<string> {
  return uploadBufferToAzurite(contents, mimeType);
}

/** Read only Azurite references. Local paths require the migration command first. */
export async function readStoredAttachment(storedReference: string): Promise<Buffer | null> {
  const blobName = blobNameFromReference(storedReference);
  if (!blobName) return null;
  try {
    return await getAzuriteContainer().getBlobClient(blobName).downloadToBuffer();
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) return null;
    throw error;
  }
}

/** Delete only Azurite references; local files are left untouched by app requests. */
export async function deleteStoredAttachment(storedReference: string): Promise<void> {
  const blobName = blobNameFromReference(storedReference);
  if (!blobName) throw new Error("attachment_azurite_migration_required");
  await getAzuriteContainer().getBlobClient(blobName).deleteIfExists();
}
