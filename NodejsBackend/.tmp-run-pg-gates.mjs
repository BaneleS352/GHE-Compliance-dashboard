// Temporary pg-gate runner (deleted after use, never committed).
// Boots embedded PostgreSQL on 55434 with disposable databases, then runs
// pg:test and pg:smoke against them.
import { spawnSync } from "node:child_process";

const embeddedMod = await import("embedded-postgres");
const EmbeddedPostgres = embeddedMod.default || embeddedMod;
const pg = new EmbeddedPostgres({
  user: "postgres",
  password: "postgres",
  port: 55434,
  persistent: false,
  databaseDir: "C:\\Users\\Ndae\\AppData\\Local\\Temp\\ghe-pg-gates",
  initdbFlags: ["-E", "UTF8", "--locale=C"],
});
await pg.initialise().catch(() => undefined);
await pg.start();
await pg.createDatabase("ghe_int").catch(() => undefined);
await pg.createDatabase("ghe_smoke").catch(() => undefined);

const base = "postgresql://postgres:postgres@localhost:55434";
const env = {
  ...process.env,
  TEST_PG_DATABASE_URL: `${base}/ghe_int?schema=public`,
  SMOKE_PG_DATABASE_URL: `${base}/ghe_smoke?schema=public`,
};
const which = process.argv[2] || "both";
let code = 0;
for (const script of which === "both" ? ["pg:test", "pg:smoke"] : [which]) {
  console.log(`\n===== npm run ${script} =====`);
  const r = spawnSync("npm", ["run", script], { cwd: process.cwd(), env, stdio: "inherit", shell: true });
  code = r.status ?? 1;
  if (code !== 0) break;
}
try { await pg.stop(); } catch { /* ignore */ }
process.exit(code);
