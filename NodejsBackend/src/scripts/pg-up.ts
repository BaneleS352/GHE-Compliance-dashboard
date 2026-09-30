/**
 * Local PostgreSQL bring-up (`npm run db:pg:up`).
 *
 * PostgreSQL is the only supported provider. Point `.env` DATABASE_URL at a
 * PostgreSQL database and run this script: it performs every step the Docker
 * entrypoint performs, adapted for a local checkout. Steps (fail-fast, like
 * production):
 *
 *   1. Guard: DATABASE_URL must be a postgres(ql) URL.
 *   2. Regenerate the Prisma client.
 *   3. `prisma migrate deploy` (0000_baseline -> 0006_numeric_keys).
 *      On failure nothing is retried; an existing pre-migration database
 *      needs the one-time BASELINE.md resolve procedure instead.
 *   4. Seed ONLY if the database is empty (0 users); never overwrites.
 *
 * Afterwards run `npm run dev`. To start over with a clean database, drop
 * and recreate the PostgreSQL database, then re-run this script.
 */
import "dotenv/config";
import { execFileSync, spawnSync } from "child_process";

const ROOT = process.cwd();

function mask(url: string): string {
  return url.replace(/:[^:@/]+@/, ":***@");
}

function prismaBin(): string {
  // Invoke the LOCAL Prisma CLI directly via node instead of `npx`: on hosts
  // where npx resolves a different Prisma version, setup fails with a
  // schema-engine error before anything runs.
  try {
    return require.resolve("prisma/build/index.js");
  } catch {
    console.error(
      "Cannot resolve the local Prisma CLI (node_modules/prisma). " +
        "Run `npm install` first (postinstall runs `prisma generate`).",
    );
    process.exit(1);
  }
}

function prismaCmd(args: string[], env: NodeJS.ProcessEnv, hint: string) {
  try {
    execFileSync(process.execPath, [prismaBin(), ...args], {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });
  } catch {
    console.error(`\nFAILED: prisma ${args.join(" ")}. ${hint}`);
    process.exit(1);
  }
}

function tsxScript(script: string, env: NodeJS.ProcessEnv, hint: string) {
  const res = spawnSync("npx", ["tsx", script], {
    cwd: ROOT,
    env,
    stdio: "inherit",
    shell: true,
  });
  if (res.status !== 0) {
    console.error(`\nFAILED: ${script} (status ${res.status}). ${hint}`);
    process.exit(1);
  }
}

async function main() {
  const url = process.env.DATABASE_URL || "";
  if (!url.startsWith("postgres")) {
    console.error(
      "db:pg:up requires DATABASE_URL to be a PostgreSQL URL " +
        `(got ${url ? mask(url) : "(unset)"}).\n` +
        "SQLite is no longer supported — set DATABASE_URL to PostgreSQL (see docs/SETUP.md).",
    );
    process.exit(2);
  }
  console.log(`Target: ${mask(url)}`);

  const env = { ...process.env, DATABASE_URL: url };

  console.log("--- prisma generate ---");
  prismaCmd(["generate"], env, "Run `npm install` and retry.");

  console.log("--- prisma migrate deploy ---");
  prismaCmd(
    ["migrate", "deploy"],
    env,
    "If this is a pre-migration database (tables exist, no migration history), " +
      "follow the one-time baseline/resolve procedure in prisma/BASELINE.md instead.",
  );

  console.log("--- seed if empty ---");
  tsxScript("src/scripts/seed-if-empty.ts", env, "Fix the seed error and re-run.");

  console.log("\nPostgreSQL bring-up complete. Run the server with `npm run dev`.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
