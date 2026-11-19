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

type JsonObject = Record<string, unknown>;
type ApiResult = { status: number; body: unknown };

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : {};
}

function field(value: unknown, key: string): unknown {
  return asObject(value)[key];
}
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

async function stopChild(server: ChildProcess): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      server.kill("SIGKILL");
      resolve();
    }, 5000);
    server.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    server.kill("SIGTERM");
  });
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
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const counterpartyUniqueIndexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'Counterparty'
      ORDER BY indexname
    `;
    const counterpartyScopedUniqueIndexes = counterpartyUniqueIndexes.filter((index) =>
      /^CREATE UNIQUE INDEX/i.test(index.indexdef) && /\((?:"?name"?),\s*"organizationId"\)/i.test(index.indexdef),
    );
    check(
      "counterparty scoped uniqueness has no redundant partial index",
      counterpartyScopedUniqueIndexes.length === 1 && counterpartyScopedUniqueIndexes[0]?.indexname === "Counterparty_name_organizationId_key",
      JSON.stringify(counterpartyScopedUniqueIndexes),
    );
    const cleanupColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'AttachmentCleanupOutbox'
    `;
    const cleanupColumnNames = new Set(cleanupColumns.map((column) => column.column_name));
    const cleanupRequiredColumns = [
      "id", "storageReference", "status", "attemptCount", "nextAttemptAt",
      "lockedAt", "lockedBy", "lastErrorCode", "createdAt", "updatedAt",
    ];
    check(
      "attachment cleanup outbox migration installs required columns",
      cleanupRequiredColumns.every((column) => cleanupColumnNames.has(column)),
      JSON.stringify([...cleanupColumnNames].sort()),
    );
    const cleanupIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'AttachmentCleanupOutbox'
    `;
    check(
      "attachment cleanup outbox claim index is installed",
      cleanupIndexes.some((index) => index.indexname === "AttachmentCleanupOutbox_claim_idx"),
      JSON.stringify(cleanupIndexes.map((index) => index.indexname)),
    );
  } catch (error) {
    await prisma.$disconnect();
    await jwks.close();
    throw error;
  }
  for (const [email, subject] of [
    ["admin@hb.co.za", "test-oid-admin"],
    ["nomvula@hb.co.za", "test-oid-nomvula"],
    ["sipho@hb.co.za", "test-oid-sipho"],
    ["lindiwe@hb.co.za", "test-oid-lindiwe"],
  ] as const) {
    await prisma.user.update({ where: { email }, data: { providerSubject: subject, providerIssuer: jwksBase } });
  }

  console.log(`--- start API on ${PORT} ---`);
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: ROOT,
    env: {
      ...env,
      PORT: String(PORT),
      OIDC_AUTHORITY: jwksBase,
      OIDC_ISSUER: jwksBase,
      OIDC_AUDIENCE: TEST_AUDIENCE,
      OIDC_ALLOWED_CLIENT_IDS: "test-spa-client-id",
      OIDC_REQUIRED_SCOPE: "access_as_user",
    },
    stdio: "pipe",
  });
  let serverOutput = "";
  server.stdout?.on("data", (d) => { serverOutput += d.toString(); });
  server.stderr?.on("data", (d) => { serverOutput += d.toString(); });
  try {
    check("server boots and serves /api/health", await waitForHealth(server));
    if (server.exitCode !== null) {
      console.error(serverOutput);
      throw new Error(`API process exited early with code ${server.exitCode}`);
    }

    const j = async (method: string, p: string, body?: unknown, token?: string): Promise<ApiResult> => {
      const r = await fetch(BASE + p, {
        method,
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await r.text();
      let parsed: unknown = null;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { status: r.status, body: parsed };
    };

    const adminToken = await mintSmokeToken("admin@hb.co.za", "Admin User", "test-oid-admin");
    const me = await j("GET", "/api/auth/me", undefined, adminToken);
    check("identity resolves to the local user", me.status === 200 && typeof field(me.body, "id") === "number" && field(me.body, "role") === "admin", JSON.stringify(me.body));
    const A = adminToken;
    const T = await mintSmokeToken("nomvula@hb.co.za", "Nomvula Dlamini", "test-oid-nomvula");
    check("team identity resolves", (await j("GET", "/api/auth/me", undefined, T)).status === 200);

    const stats = await j("GET", "/api/declarations/stats", undefined, A);
    const statsKpis = field(stats.body, "kpis");
    check("dashboard stats", stats.status === 200 && typeof field(statsKpis, "total") === "number" && Array.isArray(field(stats.body, "complianceTrend")));

    const created = await j("POST", "/api/declarations", {
      employee: "Nomvula Dlamini", employeeId: 1, teamMemberNumber: "HB-204478",
      lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing",
      type: "Gift", counterparty: "SmokeCo", value: 5000, submitted: "2026-09-30",
      priority: "Low", description: "smoke", relationship: "Supplier", receivedGiven: "Received",
      from: "Supplier", contactPerson: "C", biddingProcess: "No", occasion: "Business Meeting",
      date: "2026-09-29", instances: "1", publicOfficial: "No",
    }, T);
    check("create declaration", created.status === 201 && typeof field(created.body, "id") === "string");
    const declId = field(created.body, "id");
    if (typeof declId !== "string") throw new Error("Smoke declaration response did not include an id");
    const submitted = await j("PATCH", `/api/declarations/${declId}/submit`, {}, T);
    check("submit declaration", submitted.status === 200 && field(submitted.body, "status") === "Pending");

    const lmToken = await mintSmokeToken("sipho@hb.co.za", "Sipho Nkosi", "test-oid-sipho");
    const lmApprove = await j("POST", "/api/workflows/approve", { declarationId: declId, decision: "accept" }, lmToken);
    check("LM approve", lmApprove.status === 200 && field(lmApprove.body, "newStatus") === "Pending");
    const hrToken = await mintSmokeToken("lindiwe@hb.co.za", "Lindiwe Zulu", "test-oid-lindiwe");
    const hrApprove = await j("POST", "/api/workflows/approve", { declarationId: declId, decision: "org" }, hrToken);
    check("HR approve completes", hrApprove.status === 200 && field(hrApprove.body, "newStatus") === "Approved");

    const timeline = await j("GET", `/api/workflows/instances/${declId}`, undefined, A);
    const timelineSteps = field(timeline.body, "steps");
    check("workflow timeline from rows", timeline.status === 200 && Array.isArray(timelineSteps) && timelineSteps.length === 2);

    const draft = await j("POST", "/api/declarations", {
      employee: "Nomvula Dlamini", employeeId: 1, teamMemberNumber: "HB-204478",
      lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing",
      type: "Gift", counterparty: "SmokeFiles", value: 10, submitted: "2026-09-30",
      priority: "Low", description: "smoke files", relationship: "Supplier", receivedGiven: "Received",
      from: "Supplier", contactPerson: "C", biddingProcess: "No", occasion: "Business Meeting",
      date: "2026-09-29", instances: "1", publicOfficial: "No",
    }, T);
    const fd = new FormData();
    const draftId = field(draft.body, "id");
    if (typeof draftId !== "string") throw new Error("Smoke draft response did not include an id");
    fd.append("declarationId", draftId);
    fd.append("file", new Blob(["smoke"], { type: "text/plain" }), "smoke.txt");
    const upRes = await fetch(`${BASE}/api/files/upload`, { method: "POST", headers: { authorization: `Bearer ${T}` }, body: fd });
    const upBody: unknown = await upRes.json().catch(() => null);
    const uploadedFileId = field(upBody, "id");
    check("file upload via join", upRes.status === 201 && typeof uploadedFileId === "number");
    if (upRes.status === 201) {
      if (typeof uploadedFileId !== "number") throw new Error("Smoke upload response did not include a numeric id");
      const dl = await fetch(`${BASE}/api/files/${uploadedFileId}`, { headers: { authorization: `Bearer ${T}` } });
      check("file download", dl.status === 200 && (await dl.text()) === "smoke");
    }

    const reports = await j("GET", "/api/reports/list", undefined, A);
    check("reports list", reports.status === 200 && Array.isArray(reports.body));
    const rules = await j("GET", "/api/admin/workflows/rules", undefined, A);
    check("admin rules with numeric ids", rules.status === 200 && Array.isArray(rules.body) && rules.body.every((rule) => typeof field(rule, "id") === "number"));
    const dropdowns = await j("GET", "/api/admin/config/dropdowns", undefined, A);
    check("dropdowns from master data", dropdowns.status === 200 && Array.isArray(field(dropdowns.body, "departments")));

    // Integrity assertions (db:verify successor — no legacy mirror remains).
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
    const dangling = await prisma.$queryRaw<{ cp: bigint; du: bigint; st: bigint }[]>`
      SELECT (SELECT COUNT(*) FROM "Declaration" d LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId" WHERE d."counterpartyId" IS NOT NULL AND c."id" IS NULL) AS cp,
                (SELECT COUNT(*) FROM "Declaration" d LEFT JOIN "User" u ON u."id" = d."declarerUserId" WHERE d."declarerUserId" IS NOT NULL AND u."id" IS NULL) AS du,
                (SELECT COUNT(*) FROM "WorkflowInstanceStep" s LEFT JOIN "WorkflowInstance" w ON w."id" = s."instanceId" WHERE w."id" IS NULL) AS st`;
    check("no dangling FK references", Number(dangling[0].cp) === 0 && Number(dangling[0].du) === 0 && Number(dangling[0].st) === 0, JSON.stringify({ cp: Number(dangling[0].cp), du: Number(dangling[0].du), st: Number(dangling[0].st) }));
    const monthly = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "v_declarations_monthly"`;
    check("reporting views serve rows", Number(monthly[0].n) > 0);
  } finally {
    await stopChild(server);
    await prisma.$disconnect();
    await jwks.close();
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
