// Local stand-in for CI postgres services: boots embedded-postgres and runs
// `npm run pg:test` + `npm run pg:smoke` against it. Not part of the repo.
import { spawnSync } from "child_process";
import os from "os";
import path from "path";

const BACKEND = "C:\\Users\\Ndae\\Documents\\GitHub\\GHE-Compliance-dashboard\\NodejsBackend";
const PORT = 55434;
const DATA_DIR = path.join(os.tmpdir(), "ghe-pg-gate");

const mod = await import("embedded-postgres");
const EmbeddedPostgres = mod.default || mod;
const embedded = new EmbeddedPostgres({
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: false,
  databaseDir: DATA_DIR,
  initdbFlags: ["-E", "UTF8", "--locale=C"],
});

function sh(cmd, env, what) {
  const res = spawnSync(cmd, { cwd: BACKEND, env, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    console.error(`GATE FAILED: ${what} (exit ${res.status})`);
    process.exitCode = 1;
  }
  return res.status;
}

try {
  await embedded.initialise();
  await embedded.start();
  await embedded.createDatabase("ghe_pg_test");
  await embedded.createDatabase("ghe_smoke");
  const base = `postgresql://postgres:postgres@localhost:${PORT}`;
  const which = process.argv[2] || "all";
  if (which === "all" || which === "pg:test") {
    console.log("=== gate: pg:test ===");
    sh("npm run pg:test", { ...process.env, TEST_PG_DATABASE_URL: `${base}/ghe_pg_test?schema=public` }, "pg:test");
  }
  if (process.exitCode) throw new Error("stop");
  if (which === "all" || which === "pg:smoke") {
    console.log("=== gate: pg:smoke ===");
    sh("npm run pg:smoke", { ...process.env, SMOKE_PG_DATABASE_URL: `${base}/ghe_smoke?schema=public` }, "pg:smoke");
  }
} catch (e) {
  console.error("gate error:", e?.message || e);
  process.exitCode = 1;
} finally {
  try { await embedded.stop(); } catch {}
}
console.log(process.exitCode ? "GATE RESULT: FAIL" : "GATE RESULT: PASS");
