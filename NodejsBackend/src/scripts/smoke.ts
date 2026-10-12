/**
 * Clean-database smoke test (`npm run pg:smoke`).
 *
 * Requires SMOKE_PG_DATABASE_URL pointing at an EMPTY, disposable PostgreSQL
 * database (CI creates a `ghe_smoke` database next to the integration one)
 * and a prior `npm run build` (the smoke exercises the built artifact).
 *
 * Flow:
 *   1. `prisma migrate deploy` (full versioned chain on a clean database).
 *   2. Seed the normalized model (`src/seed.ts`, numeric keys only).
 *   3. Start the API (`node dist/index.js`) on SMOKE_PORT.
 *   4. Exercise declaration, approval, file, reporting, and admin flows over
 *      HTTP, asserting the stable API contract (numeric ids as JSON numbers).
 *   5. Run post-flow integrity assertions (the db:verify successor: every
 *      declaration has snapshot+detail rows, every instance has step rows,
 *      no dangling FK references).
 *
 * Exits 0 when every step passes, 1 with diagnostics otherwise.
 */
import { spawn, spawnSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { startTestJwksServer, TEST_AUDIENCE } from "../test-utils/test-jwks-server";

const ROOT = process.cwd();
const PORT = Number(process.env.SMOKE_PORT || 3210);
const BASE = `http://localhost:${PORT}`;

const failures: string[] = [];
let checks = 0;

function check(name: string, cond: boolean, detail?: string) {
  checks++;
  if (cond) {
    console.log(`ok   - ${name}`);
  } else {
    failures.push(name);
    console.log(`FAIL - ${name}${detail ? `: ${detail}` : ""}`);
  }
}

function sh(cmd: string, env: NodeJS.ProcessEnv, what: string) {
  const res = spawnSync(cmd, { cwd: ROOT, env, stdio: "pipe", shell: true });
  if (res.status !== 0) {
    console.error(`FAILED: ${what}\n${res.stdout?.toString()}${res.stderr?.toString()}`);
    process.exit(1);
  }
}

async function waitForHealth(server: ChildProcess): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) return false;
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let jwksBase = "";

async function mintSmokeToken(email: string, name: string, oid: string): Promise<string> {
  const r = await fetch(`${jwksBase}/test-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name, oid }),
  });
  if (!r.ok) throw new Error(`test identity minting failed: ${r.status}`);
  return r.text();
}

async function main() {
  const url = process.env.SMOKE_PG_DATABASE_URL || "";
  if (!url.startsWith("postgres")) {
    console.error("pg:smoke requires SMOKE_PG_DATABASE_URL pointing at an empty PostgreSQL database.");
    process.exit(2);
  }
  const distIndex = path.join(ROOT, "dist", "index.js");
  if (!fs.existsSync(distIndex)) {
    console.error("pg:smoke requires a prior `npm run build` (missing dist/index.js).");
    process.exit(2);
  }
  const env = { ...process.env, DATABASE_URL: url };

  console.log("--- prisma migrate deploy (clean database) ---");
  sh("npx prisma migrate deploy", env, "prisma migrate deploy");

  console.log("--- seed normalized model ---");
  sh("npx tsx src/seed.ts", env, "seed");

  // Test-only identity provider (OpenID Phase 5 seam): the smoke backend
  // validates RS256 tokens against this throwaway JWKS, and tokens below
  // are minted from it per seeded email. No production credentials exist.
  console.log("--- start test identity provider ---");
  const jwks = await startTestJwksServer();
  jwksBase = jwks.baseUrl;
  const stopJwks = () => {
    jwks.close().catch(() => undefined);
  };
  process.on("exit", stopJwks);

  console.log(`--- start API on ${PORT} ---`);
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: ROOT,
    env: {
      ...env,
      PORT: String(PORT),
      OIDC_AUTHORITY: jwksBase,
      OIDC_ISSUER: jwksBase,
      OIDC_AUDIENCE: TEST_AUDIENCE,
      OIDC_CLIENT_ID: "smoke-client-id",
    },
    stdio: "pipe",
  });
  let serverOutput = "";
  server.stdout?.on("data", (d) => { serverOutput += d.toString(); });
  server.stderr?.on("data", (d) => { serverOutput += d.toString(); });
  const stop = () => {
    try { server.kill("SIGTERM"); } catch { /* already gone */ }
  };
  process.on("exit", stop);

  try {
    check("server boots and serves /api/health", await waitForHealth(server));
    if (server.exitCode !== null) {
      console.error(serverOutput);
      process.exit(1);
    }

    const j = async (method: string, p: string, body?: any, token?: string) => {
      const r = await fetch(BASE + p, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let parsed: any = null;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: r.status, body: parsed };
    };

    const adminToken = await mintSmokeToken("admin@hb.co.za", "Admin User", "test-oid-admin");
    const me = await j("GET", "/api/auth/me", undefined, adminToken);
    check("identity resolves to the local user", me.status === 200 && typeof me.body?.id === "number" && me.body?.role === "admin", JSON.stringify(me.body));
    const A = adminToken;
    const T = await mintSmokeToken("nomvula@hb.co.za", "Nomvula Dlamini", "test-oid-nomvula");
    check("team identity resolves", (await j("GET", "/api/auth/me", undefined, T)).status === 200);

    const stats = await j("GET", "/api/declarations/stats", undefined, A);
    check("dashboard stats", stats.status === 200 && typeof stats.body?.kpis?.total === "number" && Array.isArray(stats.body?.complianceTrend));

    const created = await j("POST", "/api/declarations", {
      employee: "Nomvula Dlamini", employeeId: 1, teamMemberNumber: "HB-204478",
      lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing",
      type: "Gift", counterparty: "SmokeCo", value: 5000, submitted: "2026-09-30",
      priority: "Low", description: "smoke", relationship: "Supplier", receivedGiven: "Received",
      from: "Supplier", contactPerson: "C", biddingProcess: "No", occasion: "Business Meeting",
      date: "2026-09-29", instances: "1", publicOfficial: "No",
    }, T);
    check("create declaration", created.status === 201 && typeof created.body?.id === "string");
    const declId = created.body?.id;
    const submitted = await j("PATCH", `/api/declarations/${declId}/submit`, {}, T);
    check("submit declaration", submitted.status === 200 && submitted.body?.status === "Pending");

    const lmToken = await mintSmokeToken("sipho@hb.co.za", "Sipho Nkosi", "test-oid-sipho");
    const lmApprove = await j("POST", "/api/workflows/approve", { declarationId: declId, decision: "accept" }, lmToken);
    check("LM approve", lmApprove.status === 200 && lmApprove.body?.newStatus === "Pending");
    const hrToken = await mintSmokeToken("lindiwe@hb.co.za", "Lindiwe Zulu", "test-oid-lindiwe");
    const hrApprove = await j("POST", "/api/workflows/approve", { declarationId: declId, decision: "org" }, hrToken);
    check("HR approve completes", hrApprove.status === 200 && hrApprove.body?.newStatus === "Approved");

    const timeline = await j("GET", `/api/workflows/instances/${declId}`, undefined, A);
    check("workflow timeline from rows", timeline.status === 200 && timeline.body?.steps?.length === 2);

    const draft = await j("POST", "/api/declarations", {
      employee: "Nomvula Dlamini", employeeId: 1, teamMemberNumber: "HB-204478",
      lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing",
      type: "Gift", counterparty: "SmokeFiles", value: 10, submitted: "2026-09-30",
      priority: "Low", description: "smoke files", relationship: "Supplier", receivedGiven: "Received",
      from: "Supplier", contactPerson: "C", biddingProcess: "No", occasion: "Business Meeting",
      date: "2026-09-29", instances: "1", publicOfficial: "No",
    }, T);
    const fd = new FormData();
    fd.append("declarationId", draft.body.id);
    fd.append("file", new Blob(["smoke"], { type: "text/plain" }), "smoke.txt");
    const upRes = await fetch(`${BASE}/api/files/upload`, { method: "POST", headers: { authorization: `Bearer ${T}` }, body: fd });
    const upBody: any = await upRes.json().catch(() => null);
    check("file upload via join", upRes.status === 201 && typeof upBody?.id === "number");
    if (upRes.status === 201) {
      const dl = await fetch(`${BASE}/api/files/${upBody.id}`, { headers: { authorization: `Bearer ${T}` } });
      check("file download", dl.status === 200 && (await dl.text()) === "smoke");
    }

    const reports = await j("GET", "/api/reports/list", undefined, A);
    check("reports list", reports.status === 200 && Array.isArray(reports.body));
    const rules = await j("GET", "/api/admin/workflows/rules", undefined, A);
    check("admin rules with numeric ids", rules.status === 200 && rules.body?.every((r: any) => typeof r.id === "number"));
    const dropdowns = await j("GET", "/api/admin/config/dropdowns", undefined, A);
    check("dropdowns from master data", dropdowns.status === 200 && Array.isArray(dropdowns.body?.departments));

    // Integrity assertions (db:verify successor — no legacy mirror remains).
    // Explicit datasource: this process's own DATABASE_URL is the developer
    // database, not the disposable smoke database.
    const prisma = new PrismaClient({ datasourceUrl: url });
    try {
      const [decls, snaps, details, instances, steps] = await Promise.all([
        prisma.declaration.count(),
        prisma.declarationSnapshot.count(),
        prisma.declarationDetail.count(),
        prisma.workflowInstance.count(),
        prisma.workflowInstanceStep.count(),
      ]);
      check("every declaration has a snapshot", decls > 0 && snaps === decls, `${snaps}/${decls}`);
      check("every declaration has details", details === decls, `${details}/${decls}`);
      check("every instance has step rows", instances > 0 && steps >= instances, `${steps}/${instances}`);
      const dangling: any[] = await prisma.$queryRawUnsafe(
        `SELECT (SELECT COUNT(*) FROM "Declaration" d LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId" WHERE d."counterpartyId" IS NOT NULL AND c."id" IS NULL) AS cp,
                (SELECT COUNT(*) FROM "Declaration" d LEFT JOIN "User" u ON u."id" = d."declarerUserId" WHERE d."declarerUserId" IS NOT NULL AND u."id" IS NULL) AS du,
                (SELECT COUNT(*) FROM "WorkflowInstanceStep" s LEFT JOIN "WorkflowInstance" w ON w."id" = s."instanceId" WHERE w."id" IS NULL) AS st`,
      );
      check("no dangling FK references", Number(dangling[0].cp) === 0 && Number(dangling[0].du) === 0 && Number(dangling[0].st) === 0, JSON.stringify({ cp: Number(dangling[0].cp), du: Number(dangling[0].du), st: Number(dangling[0].st) }));
      const monthly: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "v_declarations_monthly"`);
      check("reporting views serve rows", Number(monthly[0].n) > 0);
    } finally {
      await prisma.$disconnect();
    }
  } finally {
    stop();
  }

  console.log(`\n${checks - failures.length}/${checks} smoke checks passed`);
  if (failures.length > 0) {
    console.error(`FAILED: ${failures.join("; ")}`);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
