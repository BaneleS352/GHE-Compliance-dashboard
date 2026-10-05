// Temporary local E2E runner (deleted after use, never committed).
// Boots embedded PostgreSQL, then runs Playwright (which via webServer
// starts the backend with OIDC_* pointed at the e2e JWKS server booted by
// e2e/global-setup.ts, plus the Vite dev server).
import { spawn } from "node:child_process";

const embeddedMod = await import("embedded-postgres");
const EmbeddedPostgres = embeddedMod.default || embeddedMod;
const pg = new EmbeddedPostgres({
  user: "postgres",
  password: "postgres",
  port: 55433,
  persistent: false,
  databaseDir: "C:\\Users\\Ndae\\AppData\\Local\\Temp\\ghe-pg-e2e",
  initdbFlags: ["-E", "UTF8", "--locale=C"],
});
await pg.initialise();
await pg.start();
await pg.createDatabase("ghe_e2e").catch(() => undefined);

const env = {
  ...process.env,
  E2E_PG_DATABASE_URL: "postgresql://postgres:postgres@localhost:55433/ghe_e2e?schema=public",
};
const args = process.argv.slice(2);
const child = spawn("npx", ["playwright", "test", ...args], {
  cwd: "../Enterprise Compliance Platform",
  env,
  stdio: "inherit",
  shell: true,
});
child.on("exit", async (code) => {
  try { await pg.stop(); } catch { /* ignore */ }
  process.exit(code ?? 1);
});
