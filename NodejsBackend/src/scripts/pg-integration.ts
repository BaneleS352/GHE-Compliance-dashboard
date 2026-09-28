/**
 * PostgreSQL integration entrypoint (`npm run pg:test`).
 *
 * Requires TEST_PG_DATABASE_URL pointing at a dedicated, disposable
 * PostgreSQL database (CI provides a `postgres:16` service).
 *
 * Flow (additive only, local workflow restored afterwards):
 *   1. Back up prisma/schema.prisma and swap provider sqlite -> postgresql.
 *   2. Regenerate the Prisma client for PostgreSQL.
 *   3. `prisma migrate deploy` against TEST_PG_DATABASE_URL (validates every
 *      migration, including baseline + normalization + rule FK + views).
 *   4. Run pg-integration-checks.ts with DATABASE_URL=TEST_PG_DATABASE_URL
 *      (fixture, backfill, verify, all 7 scoped views, FK enforcement).
 *   5. Restore schema.prisma and regenerate the SQLite client, even on failure.
 */
import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const MARKER = 'provider = "sqlite"';
const PG_MARKER = 'provider = "postgresql"';

function sh(cmd: string, env: NodeJS.ProcessEnv) {
  execSync(cmd, { cwd: ROOT, env, stdio: "inherit" });
}

async function main() {
  const pgUrl = process.env.TEST_PG_DATABASE_URL;
  if (!pgUrl) {
    console.error("pg:test requires TEST_PG_DATABASE_URL (dedicated PostgreSQL database). Skipping.");
    process.exit(2);
  }
  const original = fs.readFileSync(SCHEMA, "utf8");
  if (!original.includes(MARKER)) {
    console.error("Refusing to run: prisma/schema.prisma does not contain the expected sqlite provider marker.");
    process.exit(2);
  }
  const pgEnv = { ...process.env, DATABASE_URL: pgUrl };
  try {
    fs.writeFileSync(SCHEMA, original.replace(MARKER, PG_MARKER));
    console.log("--- prisma generate (postgresql) ---");
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
  } finally {
    fs.writeFileSync(SCHEMA, original);
    console.log("--- restoring sqlite client ---");
    try {
      execSync("npx prisma generate", { cwd: ROOT, env: { ...process.env }, stdio: "inherit" });
    } catch (e) {
      console.error("WARNING: failed to regenerate the SQLite Prisma client; run `npx prisma generate` manually.");
      process.exitCode = process.exitCode || 1;
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
