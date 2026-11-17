import { describe, expect, it } from "vitest";
import { resolveAttachmentStorageConfig } from "../config/attachmentStorage";

const emulatorKey = "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";

function connectionString(endpoint: string): string {
  return `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=${emulatorKey};BlobEndpoint=${endpoint};`;
}

describe("Azurite attachment configuration", () => {
  it("defaults to the local Azurite emulator and private container name", () => {
    const result = resolveAttachmentStorageConfig({});
    expect(result.container).toBe("ghe-attachments");
    expect(result.connectionString).toContain("BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1");
  });

  it("accepts the Compose Azurite service endpoint and normalizes the container name", () => {
    const result = resolveAttachmentStorageConfig({
      AZURITE_CONNECTION_STRING: connectionString("http://azurite:10000/devstoreaccount1"),
      AZURITE_CONTAINER: "GHE-Test",
    });
    expect(result.container).toBe("ghe-test");
  });

  it.each([
    "https://127.0.0.1:10000/devstoreaccount1",
    "http://127.0.0.1:10001/devstoreaccount1",
    "http://127.0.0.1:10000/other-account",
    "https://account.blob.core.windows.net/container",
  ])("rejects a non-Azurite endpoint: %s", (endpoint) => {
    expect(() => resolveAttachmentStorageConfig({ AZURITE_CONNECTION_STRING: connectionString(endpoint) }))
      .toThrow("Attachment storage is Azurite-only");
  });

  it("rejects missing endpoints and invalid container names", () => {
    expect(() => resolveAttachmentStorageConfig({ AZURITE_CONNECTION_STRING: "AccountName=devstoreaccount1;" }))
      .toThrow("must include an Azurite BlobEndpoint");
    expect(() => resolveAttachmentStorageConfig({ AZURITE_CONTAINER: "Not a container" }))
      .toThrow("AZURITE_CONTAINER must be a valid Azure container name");
  });
});
