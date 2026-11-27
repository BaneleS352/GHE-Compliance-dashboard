import { execFileSync, spawn } from "child_process";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CapturedEmail {
  toEmail: string;
  emailSubject: string;
  emailBody: string;
  receivedAt: string;
}

async function startEmailCapture(): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const url = new URL(process.env.E2E_EMAIL_CAPTURE_URL || "http://127.0.0.1:55444");
  const port = Number(url.port || 80);
  const messages: CapturedEmail[] = [];
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.method === "GET" && request.url === "/messages") {
      response.end(JSON.stringify(messages));
      return;
    }
    if (request.method === "DELETE" && request.url === "/messages") {
      messages.length = 0;
      response.end(JSON.stringify({ cleared: true }));
      return;
    }
    if (request.method === "POST" && request.url === "/messages") {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk: string) => { body += chunk; });
      request.on("end", () => {
        try {
          const parsed = JSON.parse(body) as Partial<CapturedEmail>;
          if (typeof parsed.toEmail !== "string" || typeof parsed.emailSubject !== "string" || typeof parsed.emailBody !== "string") {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: "Invalid email message" }));
            return;
          }
          messages.push({
            toEmail: parsed.toEmail,
            emailSubject: parsed.emailSubject,
            emailBody: parsed.emailBody,
            receivedAt: new Date().toISOString(),
          });
          if (messages.length > 50) messages.shift();
          response.end(JSON.stringify({ messageId: `e2e-${messages.length}` }));
        } catch {
          response.statusCode = 400;
          response.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }
    response.statusCode = 404;
    response.end(JSON.stringify({ error: "Not found" }));
  });
  await new Promise<void>((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolveListening);
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolveClosed) => {
      server.close(() => resolveClosed());
      server.closeAllConnections();
    }),
  };
}

async function assertAzuriteReady(): Promise<void> {
  const connectionString = process.env.AZURITE_CONNECTION_STRING || "";
  const endpointText = connectionString
    .split(";")
    .find((part) => part.trim().toLowerCase().startsWith("blobendpoint="))
    ?.slice("BlobEndpoint=".length) || "http://127.0.0.1:10000";
  const endpoint = new URL(endpointText);
  const port = Number(endpoint.port || 80);
  const host = endpoint.hostname.replace(/^\[|\]$/g, "");
  await new Promise<void>((resolveReady, reject) => {
    const socket = createConnection({ host, port });
    const fail = (message: string) => {
      socket.destroy();
      reject(new Error(message));
    };
    socket.setTimeout(5000);
    socket.once("connect", () => {
      socket.destroy();
      resolveReady();
    });
    socket.once("timeout", () => fail(`Timed out connecting to Azurite at ${endpointText}`));
    socket.once("error", (error: Error) => fail(`Playwright attachment tests require Azurite at ${endpointText}: ${error.message}`));
  });
}

// Playwright E2E runs against PostgreSQL (numeric identifier cutover —
// SQLite is no longer supported). Provide a dedicated database via
// E2E_PG_DATABASE_URL (CI) or DATABASE_URL (local `docker compose up -d db`).
async function globalSetup() {
  const backendDir = resolve(__dirname, "../../NodejsBackend");
  const pgUrl = process.env.E2E_PG_DATABASE_URL || process.env.DATABASE_URL || "";
  if (!pgUrl.startsWith("postgres")) {
    throw new Error(
      "E2E requires a PostgreSQL database: set E2E_PG_DATABASE_URL (or DATABASE_URL) to a postgres(ql) URL, e.g. via `docker compose up -d db`."
    );
  }
  const testIssuer = process.env.E2E_JWKS_URL || "http://127.0.0.1:55439";
  const emailCaptureUrl = process.env.E2E_EMAIL_CAPTURE_URL || "http://127.0.0.1:55444";
  const env = {
    ...process.env,
    DATABASE_URL: pgUrl,
    NODE_ENV: "test",
    OIDC_ISSUER: testIssuer,
    GHE_TEST_IDENTITY_SEED: "true",
    LOCAL_AUTH_ENABLED: "true",
    EMAIL_API: emailCaptureUrl,
  };
  process.env.DATABASE_URL = pgUrl;

  await assertAzuriteReady();
  const prismaBin = resolve(backendDir, "node_modules/prisma/build/index.js");
  const tsxBin = resolve(backendDir, "node_modules/tsx/dist/cli.mjs");
  execFileSync(process.execPath, [prismaBin, "migrate", "deploy"], { cwd: backendDir, stdio: "inherit", env });
  execFileSync(process.execPath, [tsxBin, "src/seed.ts"], { cwd: backendDir, stdio: "inherit", env });
  const emailCapture = await startEmailCapture();

  // Start the test identity provider through the backend's own tsx runtime.
  // Invoke the local CLI directly so teardown kills the provider process, not
  // an npx/cmd wrapper that can leave an orphaned listener behind.
  const jwksUrl = process.env.E2E_JWKS_URL || "http://127.0.0.1:55439";
  const jwksEndpoint = new URL("/discovery/v2.0/keys", jwksUrl);
  const jwksPort = jwksEndpoint.port || (jwksEndpoint.protocol === "https:" ? "443" : "80");
  const jwksProcess = spawn(process.execPath, [tsxBin, "src/scripts/test-jwks-server.ts"], {
    cwd: backendDir,
    env: { ...env, TEST_JWKS_PORT: jwksPort },
    stdio: "ignore",
  });
  let launchError: Error | undefined;
  jwksProcess.once("error", (error) => {
    launchError = error;
  });
  const deadline = Date.now() + 30000;
  let providerReady = false;
  try {
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (jwksProcess.exitCode !== null || jwksProcess.signalCode !== null) {
        throw new Error(
          `Test JWKS provider exited (code ${jwksProcess.exitCode}, signal ${jwksProcess.signalCode})`
        );
      }
      try {
        const response = await fetch(jwksEndpoint);
        if (response.ok) {
          providerReady = true;
          break;
        }
      } catch {
        // The provider may need a moment to start listening.
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!providerReady) {
      throw new Error(`Test JWKS provider did not start at ${jwksEndpoint}`);
    }
  } catch (error) {
    jwksProcess.kill();
    await emailCapture.close();
    throw error;
  }

  return async () => {
    jwksProcess.kill();
    await emailCapture.close();
  };
}

export default globalSetup;
