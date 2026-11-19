import { PrismaClient } from "@prisma/client";
import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import {
  startTestJwksServer,
  testKeyMaterialPath,
  TEST_AUDIENCE,
} from "../test-utils/test-jwks-server";

// PostgreSQL is the only supported provider (Identifier Strategy cutover).
// The suite boots an embedded PostgreSQL, applies the versioned migrations,
// and seeds isolated normalized fixtures — the full suite runs against
// PostgreSQL, locally and in CI.
const PG_PORT = Number(process.env.PG_TEST_PORT || 55433);
// The embedded cluster lives outside the repo so test runs never dirty it.
// Process-scoped temp storage avoids a failed/interrupted test run leaving a
// non-empty cluster that prevents the next run's initdb from starting.
const PG_DATA_DIR = process.env.PG_TEST_DATA_DIR || path.join(os.tmpdir(), `ghe-pg-test-${process.pid}`);
const PG_URL = process.env.TEST_PG_DATABASE_URL ||
  `postgresql://postgres:postgres@localhost:${PG_PORT}/ghe_test?schema=public`;

interface EmbeddedPostgresHandle {
  initialise(): Promise<void>;
  start(): Promise<void>;
  createDatabase(name: string): Promise<void>;
  stop(): Promise<void>;
}

interface EmbeddedPostgresOptions {
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  databaseDir: string;
  initdbFlags: string[];
}

type EmbeddedPostgresConstructor = new (options: EmbeddedPostgresOptions) => EmbeddedPostgresHandle;

let embedded: EmbeddedPostgresHandle | null = null;
let jwksClose: (() => Promise<void>) | null = null;
let azuriteTestContainer: ContainerClient | null = null;

function errorLabel(error: unknown): string {
  if (error instanceof Error) {
    const code = "code" in error ? String(error.code) : "";
    return code || error.name;
  }
  return typeof error === "string" ? error : "unknown";
}

function migrationFailureDetail(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const withOutput = error as Error & { stdout?: string | Uint8Array; stderr?: string | Uint8Array };
  const output = [withOutput.stdout?.toString(), withOutput.stderr?.toString()]
    .filter((part): part is string => Boolean(part?.trim()))
    .join("\n");
  return output || error.message;
}

async function startAzurite(): Promise<void> {
  process.env.AZURITE_CONNECTION_STRING ||= "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";
  process.env.AZURITE_CONTAINER = `ghe-test-${process.pid}`;
  azuriteTestContainer = BlobServiceClient.fromConnectionString(process.env.AZURITE_CONNECTION_STRING)
    .getContainerClient(process.env.AZURITE_CONTAINER);
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await azuriteTestContainer.createIfNotExists();
      return;
    } catch (error: unknown) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(
    "Backend integration checks require Azurite Blob Storage on localhost:10000. " +
      "Start it with `docker compose -f docker-compose.azurite.yml up -d --wait azurite`. " +
      `Cause: ${errorLabel(lastError)}`,
  );
}

async function startEmbeddedPostgres(): Promise<void> {
  if (process.env.TEST_PG_DATABASE_URL) return;
  // ESM-only package: classic moduleResolution cannot resolve its types, but
  // vitest/tsx load it fine at runtime.
  // @ts-ignore
  const mod = await import("embedded-postgres") as unknown as { default: EmbeddedPostgresConstructor };
  const EmbeddedPostgres = mod.default;
  embedded = new EmbeddedPostgres({
    user: "postgres",
    password: "postgres",
    port: PG_PORT,
    persistent: false,
    databaseDir: PG_DATA_DIR,
    // UTF8/C regardless of host locale: the migration SQL contains non-ASCII
    // comment text and the suite must not depend on OS locale settings.
    initdbFlags: ["-E", "UTF8", "--locale=C"],
  });
  try {
    await embedded.initialise();
    await embedded.start();
    await embedded.createDatabase("ghe_test");
  } catch (err: unknown) {
    throw new Error(
      "Embedded PostgreSQL failed to start (port " + PG_PORT + "). " +
        "Backend tests require PostgreSQL: free the port, or set " +
        "TEST_PG_DATABASE_URL to a dedicated PostgreSQL database. " +
        "CI runs the suite against a postgres service. Cause: " +
        (err instanceof Error ? err.message : String(err)),
    );
  }
}

export async function setup() {
  if (process.env.TEST_SKIP_AZURITE === "1") {
    console.warn("[test setup] Azurite startup skipped; run only tests that do not access attachments.");
  } else {
    await startAzurite();
  }
  await startEmbeddedPostgres();
  process.env.DATABASE_URL = PG_URL;

  // Test-only identity provider (OpenID Phase 5 seam): a throwaway local
  // JWKS + fixed test issuer/audience. Forked workers inherit these vars,
  // exactly like DATABASE_URL above. Production points OIDC_AUTHORITY at
  // the real Entra tenant and never sees this server.
  const jwks = await startTestJwksServer();
  jwksClose = jwks.close;
  fs.writeFileSync(testKeyMaterialPath(), JSON.stringify(jwks.material), { mode: 0o600 });
  process.env.OIDC_AUTHORITY = jwks.baseUrl;
  process.env.OIDC_ISSUER = jwks.baseUrl;
  process.env.OIDC_AUDIENCE = TEST_AUDIENCE;
  process.env.OIDC_ALLOWED_CLIENT_IDS = "test-spa-client-id";
  process.env.OIDC_REQUIRED_SCOPE = "access_as_user";

  // Invoke the LOCAL Prisma CLI directly via node instead of `npx`: on hosts
  // where npx resolves a different Prisma version, setup fails before any
  // test runs.
  let prismaBin: string;
  try {
    prismaBin = require.resolve("prisma/build/index.js");
  } catch {
    throw new Error(
      "Cannot resolve the local Prisma CLI (node_modules/prisma). " +
        "Ensure dependencies are installed (`npm install`, which runs `prisma generate` via postinstall).",
    );
  }
  // Versioned migrations (not db push): the suite runs the same migration
  // chain production deploys.
  try {
    execFileSync(
      process.execPath,
      [prismaBin, "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: PG_URL },
        stdio: "pipe",
      },
    );
  } catch (err: unknown) {
    const detail = migrationFailureDetail(err);
    console.error("Test database migration failed (`prisma migrate deploy`). Engine output:\n" + detail);
    throw new Error(`Test database migration failed: ${detail.split("\n")[0]}`);
  }

  const prisma = new PrismaClient();

  // Fixture users carry no credentials: authentication is Entra-shaped
  // RS256 in tests (see testAuth.ts), resolved by issuer and subject.

  // Numeric fixture ids (shared with helpers.ts tokens).
  // Fixture organization exists only to host Department master rows:
  // departmentId is the sole department source, and the HR routing resolves
  // through department links. Fixture users stay organization-less (null org)
  // exactly like before, so declaration scoping behavior is unchanged; they
  // link the shared master rows for display and HR routing.
  const { resolveDepartmentId } = await import("../services/normalization");
  const fixtureOrg = await prisma.organization.upsert({
    where: { shortCode: "TST" },
    update: { name: "Test Organisation" },
    create: { name: "Test Organisation", shortCode: "TST" },
  });
  const deptByName = new Map<string, bigint>();
  for (const name of ["IT", "Marketing", "HR"]) {
    const id = await resolveDepartmentId(name, fixtureOrg.id);
    if (id !== null) deptByName.set(name, id);
  }
  await prisma.user.createMany({
    data: [
      { id: 1n, name: "Admin User", email: "admin@test.com", role: "admin", teamMemberNumber: "ADM-001", departmentId: deptByName.get("IT"), position: "System Admin", providerSubject: "test-oid-admin", providerIssuer: process.env.OIDC_ISSUER || `http://127.0.0.1:${process.env.TEST_JWKS_PORT || "55439"}` },
      { id: 2n, name: "Sipho Approver", email: "sipho@test.com", role: "approver", teamMemberNumber: "APR-001", departmentId: deptByName.get("Marketing"), position: "Line Manager", providerSubject: "test-oid-sipho", providerIssuer: process.env.OIDC_ISSUER || `http://127.0.0.1:${process.env.TEST_JWKS_PORT || "55439"}` },
      { id: 3n, name: "Lindiwe HR", email: "lindiwe@test.com", role: "approver", teamMemberNumber: "APR-002", departmentId: deptByName.get("HR"), position: "Head of HR", providerSubject: "test-oid-lindiwe", providerIssuer: process.env.OIDC_ISSUER || `http://127.0.0.1:${process.env.TEST_JWKS_PORT || "55439"}` },
      { id: 4n, name: "Nomvula Team", email: "nomvula@test.com", role: "teamMember", teamMemberNumber: "TM-001", departmentId: deptByName.get("Marketing"), position: "Brand Manager", providerSubject: "test-oid-nomvula", providerIssuer: process.env.OIDC_ISSUER || `http://127.0.0.1:${process.env.TEST_JWKS_PORT || "55439"}` },
    ],
  });
  // Normalized user links (manager FK).
  await prisma.user.update({ where: { id: 4n }, data: { managerId: 2n } });

  await prisma.systemConfig.create({
    data: { id: "default", highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}", notificationTemplates: "{}" },
  });

  // Workflow rules + row-only step definitions.
  await prisma.workflowRule.createMany({
    data: [
      { id: 1n, name: "Low Value", condition: "low", priority: 1 },
      { id: 2n, name: "High Value", condition: "high", priority: 2 },
    ],
  });
  await prisma.workflowRuleStep.createMany({
    data: [
      { ruleId: 1n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 1, role: "lineManager", label: "Line Manager Review" },
      { ruleId: 2n, order: 2, role: "hr", label: "HR Review" },
    ],
  });

  // Counterparties (one row per name for the fixture org-less scope).
  const cpA = await prisma.counterparty.create({ data: { name: "Supplier A" } });
  const cpB = await prisma.counterparty.create({ data: { name: "Supplier B" } });
  const cpC = await prisma.counterparty.create({ data: { name: "Supplier C" } });

  // Lean declarations + snapshots + details.
  const decls = [
    {
      id: "GHE-TEST-001", type: "Gift", value: 100, status: "Pending", priority: "Low",
      eventDate: new Date("2026-01-14T00:00:00.000Z"), submittedAt: new Date("2026-01-15T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: 2n, counterpartyId: cpA.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Test declaration", occasion: "Business Meeting", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-002", type: "Gift", value: 500, status: "Pending", priority: "Medium",
      eventDate: new Date("2026-01-30T00:00:00.000Z"), submittedAt: new Date("2026-02-01T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: 2n, counterpartyId: cpB.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "Second test", occasion: "Milestone", relationship: "Test", receivedGiven: "Given", fromField: "Customer", contactPerson: "Jane", biddingProcess: "No", instances: "1", publicOfficial: "No" },
    },
    {
      id: "GHE-TEST-003", type: "Hospitality", value: 3000, status: "Approved", priority: "High",
      eventDate: new Date("2026-02-28T00:00:00.000Z"), submittedAt: new Date("2026-03-01T00:00:00.000Z"),
      declarerUserId: 4n, currentApproverUserId: null, counterpartyId: cpC.id,
      snap: { declarerName: "Nomvula Team", employeeNumber: "TM-001", positionTitle: "Brand Manager", department: "Marketing", managerDisplayName: "Sipho Approver" },
      det: { description: "High value", occasion: "Other", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Bob", biddingProcess: "Yes", instances: "2", publicOfficial: "No" },
    },
  ];
  const pkById = new Map<string, bigint>();
  for (const d of decls) {
    const { snap, det, ...row } = d;
    const created = await prisma.declaration.create({ data: row });
    pkById.set(d.id, created.declarationPk);
    await prisma.declarationSnapshot.create({ data: { declarationPk: created.declarationPk, ...snap } });
    await prisma.declarationDetail.create({ data: { declarationPk: created.declarationPk, ...det } });
  }

  // Workflow instances: rows only.
  const { persistWorkflowInstanceSteps } = await import("../services/normalization");
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-001")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], 1n);
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-002")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: 3, assigneeName: "Lindiwe HR", label: "HR Review", status: "pending", decision: null, approvedAt: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null },
  ], 2n);
  await persistWorkflowInstanceSteps(pkById.get("GHE-TEST-003")!, [
    { order: 1, role: "lineManager", assignee: 2, assigneeName: "Sipho Approver", label: "Line Manager Review", status: "approved", decision: "accept", approvedAt: "2026-03-02T10:00:00.000Z", notes: "OK", decidedAt: "2026-03-02T10:00:00.000Z", decidedById: null, decidedByName: null },
    { order: 2, role: "hr", assignee: 3, assigneeName: "Lindiwe HR", label: "HR Review", status: "approved", decision: "org", approvedAt: "2026-03-03T10:00:00.000Z", notes: "Approved", decidedAt: "2026-03-03T10:00:00.000Z", decidedById: null, decidedByName: null },
  ], 2n);

  await prisma.approvalOption.createMany({
    data: [
      { id: "ao-1", value: "return", label: "Return - Team member to provide additional information." },
      { id: "ao-2", value: "accept", label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
      { id: "ao-3", value: "org", label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
      { id: "ao-4", value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
      { id: "ao-5", value: "decline", label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
    ],
  });

  // Explicit fixture ids must not collide with later autoincrement inserts.
  const { resetIdentitySequences } = await import("../services/normalization");
  await resetIdentitySequences(prisma);

  await prisma.$disconnect();

  // Reporting views are migration-owned; nothing else to do here.
}

export async function teardown() {
  if (jwksClose) {
    try {
      await jwksClose();
    } catch {
      // Best-effort: the OS reclaims the listener in any case.
    }
    jwksClose = null;
  }
  if (embedded) {
    try {
      await embedded.stop();
    } catch {
      // Best-effort: the OS reclaims the postmaster in any case.
    }
    embedded = null;
  }
  if (azuriteTestContainer) {
    try { await azuriteTestContainer.deleteIfExists(); } catch { /* leave the isolated test container for manual cleanup */ }
    azuriteTestContainer = null;
  }
}
