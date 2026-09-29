/**
 * Local PostgreSQL bring-up (`npm run db:pg:up`).
 *
 * You changed `.env` DATABASE_URL to Postgres and want to run the server:
 * this script performs every step the Docker entrypoint performs, adapted
 * for a local checkout. Steps (fail-fast, like production):
 *
 *   1. Guard: DATABASE_URL must be a postgres(ql) URL (never SQLite here).
 *   2. Swap prisma/schema.prisma provider sqlite -> postgresql (in place;
 *      left swapped so `npm run dev` keeps working — see restore note below).
 *   3. Regenerate the Prisma client for PostgreSQL.
 *   4. `prisma migrate deploy` (0000_baseline -> 0004_monthly_eventdate).
 *      On failure nothing is retried and no `db push` fallback runs; an
 *      existing pre-migration database needs the one-time BASELINE.md
 *      resolve procedure instead.
 *   5. Seed ONLY if the database is empty (0 users); never overwrites.
 *   6. Normalization backfill (prints the reconciliation report).
 *   7. Verify gate — zero drift required, otherwise exit 1.
 *
 * Afterwards run `npm run dev`. To go back to SQLite:
 *   git checkout -- prisma/schema.prisma && npm run db:generate
 */
import "dotenv/config";
import { execFileSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const SCHEMA = path.join(ROOT, "prisma", "schema.prisma");
const MARKER = 'provider = "sqlite"';
const PG_MARKER = 'provider = "postgresql"';

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
        "This script never touches SQLite databases — local SQLite dev/test " +
        "needs no setup step beyond `npm install`.",
    );
    process.exit(2);
  }
  console.log(`Target: ${mask(url)}`);

  const env = { ...process.env, DATABASE_URL: url };
  const schema = fs.readFileSync(SCHEMA, "utf8");
  if (schema.includes(MARKER)) {
    fs.writeFileSync(SCHEMA, schema.replace(MARKER, PG_MARKER));
    console.log("--- provider swapped to postgresql (left in place for `npm run dev`) ---");
  } else if (!schema.includes(PG_MARKER)) {
    console.error("Refusing to run: prisma/schema.prisma has an unexpected provider line.");
    process.exit(2);
  } else {
    console.log("--- provider already postgresql ---");
  }

  console.log("--- prisma generate (postgresql) ---");
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

  console.log("--- normalization backfill ---");
  tsxScript("src/scripts/run-backfill.ts", env, "Fix the backfill error and re-run.");

  console.log("--- verify gate (zero drift required) ---");
  tsxScript("src/scripts/run-verify.ts", env, "Resolve the reported drift, then re-run.");

  console.log("\nPostgreSQL bring-up complete. Run the server with `npm run dev`.");
  console.log("To return to SQLite: git checkout -- prisma/schema.prisma && npm run db:generate");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
