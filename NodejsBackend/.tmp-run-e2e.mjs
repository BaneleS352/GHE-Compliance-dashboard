// Temporary local E2E runner: embedded PG + backend + frontend + Playwright,
// all inside one foreground process. Deleted after use. Not part of the repo.
import EmbeddedPostgres from "embedded-postgres";
import { execFileSync, spawn } from "child_process";
import os from "os";
import path from "path";
import fs from "fs";

const project = process.argv[2] || "desktop";
const backendDir = process.cwd();
const frontendDir = path.resolve(backendDir, "../Enterprise Compliance Platform");
const dir = path.join(os.tmpdir(), "ghe-pg-e2e");
fs.rmSync(dir, { recursive: true, force: true });

const pg = new EmbeddedPostgres({
  user: "postgres",
  password: "postgres",
  port: 55435,
  persistent: false,
  databaseDir: dir,
  initdbFlags: ["-E", "UTF8", "--locale=C"],
});

const children = [];
function teardown() {
  for (const c of children) { try { c.kill("SIGKILL"); } catch { /* ignore */ } }
}

async function waitFor(url, label) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) { console.log(`${label} up`); return; }
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error(`${label} never came up: ${url}`);
}

let ok = false;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("ghe_e2e");
  const dbUrl = "postgresql://postgres:postgres@localhost:55435/ghe_e2e?schema=public";
  const env = { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: "test-secret", PORT: "3001" };

  console.log("migrating...");
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { cwd: backendDir, env, stdio: "inherit", timeout: 300000 });
  console.log("seeding...");
  execFileSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/seed.ts"],
    { cwd: backendDir, env, stdio: "inherit", timeout: 300000 });

  console.log("starting backend...");
  children.push(spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "src/index.ts"],
    { cwd: backendDir, env, stdio: "inherit" }));
  await waitFor("http://localhost:3001/api/health", "backend");

  console.log("starting frontend...");
  children.push(spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5173", "--strictPort"],
    { cwd: frontendDir, env: process.env, stdio: "inherit" }));
  await waitFor("http://localhost:5173/", "frontend");

  console.log(`running playwright (${project})...`);
  execFileSync(process.execPath,
    ["node_modules/@playwright/test/cli.js", "test", `--project=${project}`, ...process.argv.slice(3)],
    { cwd: frontendDir, env: { ...process.env, E2E_PG_DATABASE_URL: dbUrl }, stdio: "inherit", timeout: 780000 });
  ok = true;
  console.log("E2E_PASS");
} catch (e) {
  console.log(`E2E_FAILED: ${e.message}`);
} finally {
  teardown();
  try { await pg.stop(); } catch { /* ignore */ }
  await new Promise((r) => setTimeout(r, 5000));
  try { fs.rmSync(dir, { recursive: true, force: true }); }
  catch { console.log("NOTE: scratch PG dir left for OS temp cleanup."); }
}
process.exit(ok ? 0 : 1);
