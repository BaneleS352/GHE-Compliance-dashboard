import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  const env = { ...process.env, DATABASE_URL: pgUrl };
  process.env.DATABASE_URL = pgUrl;

  execSync("npx prisma migrate deploy", { cwd: backendDir, stdio: "pipe", env });
  execSync("npx tsx src/seed.ts", { cwd: backendDir, stdio: "pipe", env });

  // Start the test identity provider through the backend's own tsx runtime.
  // Importing backend TypeScript from this ESM package makes Node interpret
  // that source under the wrong module system.
  const jwksUrl = process.env.E2E_JWKS_URL || "http://127.0.0.1:55439";
  const jwksEndpoint = new URL("/discovery/v2.0/keys", jwksUrl);
  const jwksPort = jwksEndpoint.port || (jwksEndpoint.protocol === "https:" ? "443" : "80");
  const jwksProcess = spawn("npx", ["tsx", "src/scripts/test-jwks-server.ts"], {
    cwd: backendDir,
    env: { ...env, TEST_JWKS_PORT: jwksPort },
    stdio: "ignore",
    shell: process.platform === "win32",
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
    throw error;
  }

  return async () => {
    jwksProcess.kill();
  };
}

export default globalSetup;
