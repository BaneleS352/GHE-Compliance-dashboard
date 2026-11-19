const DEFAULT_CONNECTION_STRING =
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";

export interface AttachmentStorageEnvironment {
  NODE_ENV?: string;
  AZURITE_CONNECTION_STRING?: string;
  AZURITE_CONTAINER?: string;
}

export function resolveAttachmentStorageConfig(env: AttachmentStorageEnvironment): {
  connectionString: string;
  container: string;
} {
  const configuredConnectionString = env.AZURITE_CONNECTION_STRING?.trim();
  if (env.NODE_ENV === "production" && !configuredConnectionString) {
    throw new Error("AZURITE_CONNECTION_STRING is required in production; the local Azurite fallback is development-only");
  }
  const connectionString = configuredConnectionString || DEFAULT_CONNECTION_STRING;
  const endpointText = connectionString.split(";").find((part) => part.trim().toLowerCase().startsWith("blobendpoint="))?.slice("BlobEndpoint=".length);
  if (!endpointText) {
    throw new Error("AZURITE_CONNECTION_STRING must include an Azurite BlobEndpoint");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointText);
  } catch {
    throw new Error("AZURITE_CONNECTION_STRING must contain a valid Azurite BlobEndpoint URL");
  }

  if (
    endpoint.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "azurite", "host.docker.internal"].includes(endpoint.hostname.toLowerCase()) ||
    endpoint.port !== "10000" ||
    endpoint.pathname.replace(/\/$/, "") !== "/devstoreaccount1" ||
    endpoint.search !== ""
  ) {
    throw new Error("Attachment storage is Azurite-only; BlobEndpoint must use HTTP port 10000 on localhost, azurite, or host.docker.internal");
  }

  const container = env.AZURITE_CONTAINER?.trim().toLowerCase() || "ghe-attachments";
  if (!/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(container)) {
    throw new Error("AZURITE_CONTAINER must be a valid Azure container name");
  }

  return { connectionString, container };
}

export const attachmentStorageConfig = resolveAttachmentStorageConfig(process.env);
