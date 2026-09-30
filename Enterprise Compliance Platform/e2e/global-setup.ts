import { execSync } from "child_process";
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
  const env = { ...process.env, DATABASE_URL: pgUrl, JWT_SECRET: "test-secret" };
  process.env.DATABASE_URL = pgUrl;
  process.env.JWT_SECRET = "test-secret";

  execSync("npx prisma migrate deploy", { cwd: backendDir, stdio: "pipe", env });
  execSync("npx tsx src/seed.ts", { cwd: backendDir, stdio: "pipe", env });
}

export default globalSetup;
