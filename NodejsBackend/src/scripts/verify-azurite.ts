import "dotenv/config";
import { attachmentStorageConfig } from "../config/attachmentStorage";
import { createAzuriteContainerClient } from "../services/attachmentStorage";

async function main(): Promise<void> {
  try {
    const container = createAzuriteContainerClient();
    await container.createIfNotExists();
    console.log(`[PASS] Azurite Blob endpoint reachable; private container "${attachmentStorageConfig.container}" is available.`);
    console.log("[INFO] No attachment was uploaded, read, or deleted.");
  } catch (error: unknown) {
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
      : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
    console.error(`[FAIL] Azurite check failed (${code || "UnknownError"}). Start Azurite and check AZURITE_CONNECTION_STRING.`);
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(`[FAIL] Azurite check could not start (${error instanceof Error ? error.name : "UnknownError"}).`);
  process.exitCode = 1;
});
