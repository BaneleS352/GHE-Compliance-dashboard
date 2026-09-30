/**
 * PostgreSQL integration entrypoint (`npm run pg:test`).
 *
 * Requires TEST_PG_DATABASE_URL pointing at a dedicated, disposable
 * PostgreSQL database (CI provides a `postgres:16` service).
 *
 * Flow:
 *   1. Regenerate the Prisma client.
 *   2. `prisma migrate deploy` against TEST_PG_DATABASE_URL (validates the
 *      full chain: baseline + normalization + rule FK + counterparty
 *      uniqueness + monthly view + Phase 5 retirement + numeric keys).
 *   3. Run pg-integration-checks.ts with DATABASE_URL=TEST_PG_DATABASE_URL
 *      (numeric-key assertions, normalized fixtures, all 7 scoped views, FK
 *      enforcement and delete rules, counterparty identity policy).
 */
import { execSync, spawnSync } from "child_process";

const ROOT = process.cwd();

function sh(cmd: string, env: NodeJS.ProcessEnv) {
  execSync(cmd, { cwd: ROOT, env, stdio: "inherit" });
}

async function main() {
  const pgUrl = process.env.TEST_PG_DATABASE_URL;
  if (!pgUrl) {
    console.error("pg:test requires TEST_PG_DATABASE_URL (dedicated PostgreSQL database). Skipping.");
    process.exit(2);
  }
  const pgEnv = { ...process.env, DATABASE_URL: pgUrl };
  console.log("--- prisma generate ---");
  sh("npx prisma generate", pgEnv);
  console.log("--- prisma migrate deploy ---");
  sh("npx prisma migrate deploy", pgEnv);
  console.log("--- integration checks ---");
  const res = spawnSync("npx", ["tsx", "src/scripts/pg-integration-checks.ts"], {
    cwd: ROOT,
    env: { ...pgEnv, DATABASE_URL: pgUrl },
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`pg-integration-checks failed with status ${res.status}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
