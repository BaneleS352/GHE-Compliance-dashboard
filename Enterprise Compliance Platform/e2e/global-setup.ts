import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function globalSetup() {
  const backendDir = resolve(__dirname, "../../NodejsBackend");
  const env = { ...process.env, DATABASE_URL: "file:./dev.db", JWT_SECRET: "test-secret" };

  execSync("npx prisma db push --skip-generate", { cwd: backendDir, stdio: "pipe", env });
  execSync("npx tsx src/seed.ts", { cwd: backendDir, stdio: "pipe", env });
}

export default globalSetup;
