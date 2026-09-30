import { prisma } from "../config/prisma";

/**
 * Phase 5 reporting read models.
 *
 * Views are read models, not replacements for transactional tables or
 * authorization. API authorization, organisation scoping, and parameter
 * validation remain required.
 *
 * DDL ownership: PostgreSQL views are owned by versioned migrations
 * (0005_phase5_retirement); the application role needs only SELECT.
 * `ensureReportingViews()` below executes DDL on SQLite dev/test only, where
 * `db push` does not apply migrations. On PostgreSQL it is a no-op.
 */

export function isPostgresProvider(): boolean {
  return (process.env.DATABASE_URL || "").startsWith("postgres");
}

/**
 * Rewrite `?` placeholders to PostgreSQL `$1..$n` positional parameters.
 * Constraint: view SQL must only use `?` as a value placeholder — never put
 * a literal `?` inside a string literal.
 */
export function bindParams(sql: string): string {
  if (!isPostgresProvider()) return sql;
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// SQLite-only DDL (dev/test via `db push`). PostgreSQL definitions live in
// 0005_phase5_retirement and additionally carry the typed monthly view.
const VIEWS_SQLITE: { name: string; select: string }[] = [
  {
    name: "v_declaration_status_summary",
    select: `SELECT "organizationId" AS "organizationId", "status" AS "status",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "status"`,
  },
  {
    name: "v_declarations_monthly",
    select: `SELECT "organizationId" AS "organizationId",
          strftime('%Y-%m', "eventDate" / 1000, 'unixepoch') AS "month",
          COUNT(*) AS "count",
          SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
          SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
          SUM("value") AS "totalValue"
   FROM "Declaration" WHERE "eventDate" IS NOT NULL
   GROUP BY "organizationId", strftime('%Y-%m', "eventDate" / 1000, 'unixepoch')`,
  },
  {
    name: "v_declaration_type_breakdown",
    select: `SELECT "organizationId" AS "organizationId", "type" AS "type",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "type"`,
  },
  {
    name: "v_workflow_current_step",
    select: `SELECT "declarationId", "stepOrder", "role", "assigneeId", "assigneeName", "status"
   FROM "WorkflowInstanceStep" WHERE "status" = 'pending'`,
  },
  {
    name: "v_workflow_step_sla",
    select: `SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
          d."eventDate" AS "eventDate"
   FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."id" = s."declarationId"
   WHERE s."decidedAt" IS NOT NULL`,
  },
  {
    name: "v_counterparty_concentration",
    select: `SELECT d."organizationId" AS "organizationId",
          COALESCE(c."name", 'Unknown') AS "counterparty",
          COUNT(*) AS "count", SUM(d."value") AS "totalValue",
          AVG(d."value") AS "avgValue"
   FROM "Declaration" d LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId"
   GROUP BY d."organizationId", COALESCE(c."name", 'Unknown')`,
  },
  {
    name: "v_high_value_declarations",
    select: `SELECT d."id" AS "id", s."declarerName" AS "employee",
          s."managerDisplayName" AS "lineManager", s."department" AS "department",
          d."type" AS "type", COALESCE(c."name", 'Unknown') AS "counterparty",
          d."value" AS "value", d."eventDate" AS "date", d."status" AS "status",
          d."organizationId" AS "organizationId"
   FROM "Declaration" d
   LEFT JOIN "DeclarationSnapshot" s ON s."declarationId" = d."id"
   LEFT JOIN "Counterparty" c ON c."id" = d."counterpartyId"`,
  },
];

let ensured = false;

export async function ensureReportingViews(): Promise<void> {
  if (ensured) return;
  // Production PostgreSQL: migrations own the views; never require DDL here.
  if (isPostgresProvider()) {
    ensured = true;
    return;
  }
  for (const v of VIEWS_SQLITE) {
    const ddl = `CREATE VIEW IF NOT EXISTS "${v.name}" AS ${v.select}`;
    try {
      await prisma.$executeRawUnsafe(ddl);
    } catch (err) {
      console.warn(`reportingViews: failed to ensure view ${v.name}:`, (err as Error)?.message || err);
    }
  }
  ensured = true;
}

async function queryView<T>(sql: string, params: any[]): Promise<T[] | null> {
  await ensureReportingViews();
  try {
    return await prisma.$queryRawUnsafe(bindParams(sql), ...params);
  } catch {
    return null;
  }
}

export async function viewStatusSummary(organizationId?: string) {
  const rows = await viewStatusSummaryFull(organizationId);
  if (!rows) return null;
  const out: Record<string, number> = {};
  // Number() conversion: PostgreSQL COUNT(*) arrives as BigInt via raw
  // queries and JSON.stringify(BigInt) throws — this runs on the reports
  // path that returns straight to res.json.
  for (const r of rows) out[r.status] = Number(r.count);
  return out;
}

/** Status rows with value totals (powers the dashboard KPIs). */
export async function viewStatusSummaryFull(organizationId?: string): Promise<{ status: string; count: number; totalValue: number }[] | null> {
  const rows = await queryView<any>(
    `SELECT "status" AS "status", "count" AS "count", "totalValue" AS "totalValue" FROM "v_declaration_status_summary"` +
      (organizationId ? ` WHERE "organizationId" = ?` : ""),
    organizationId ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({ status: String(r.status), count: Number(r.count), totalValue: Number(r.totalValue) }));
}

export async function viewMonthly(organizationId?: string) {
  return queryView<any>(
    `SELECT "month" AS "month", "count" AS "count", "approved" AS "approved",` +
      ` "declined" AS "declined", "totalValue" AS "totalValue" FROM "v_declarations_monthly"` +
      (organizationId ? ` WHERE "organizationId" = ? ORDER BY "month" ASC` : ` ORDER BY "month" ASC`),
    organizationId ? [organizationId] : [],
  );
}

export async function viewTypeBreakdown(organizationId?: string) {
  return queryView<any>(
    `SELECT "type" AS "type", "count" AS "count", "totalValue" AS "totalValue"` +
      ` FROM "v_declaration_type_breakdown"` +
      (organizationId ? ` WHERE "organizationId" = ?` : ""),
    organizationId ? [organizationId] : [],
  );
}

export async function viewCounterparty(organizationId?: string) {
  const rows = await queryView<any>(
    `SELECT "counterparty" AS "counterparty", "count" AS "count",` +
      ` "totalValue" AS "totalValue", "avgValue" AS "avgValue"` +
      ` FROM "v_counterparty_concentration"` +
      (organizationId ? ` WHERE "organizationId" = ? ORDER BY "totalValue" DESC` : ` ORDER BY "totalValue" DESC`),
    organizationId ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({
    counterparty: String(r.counterparty),
    count: Number(r.count),
    totalValue: Number(r.totalValue),
    avgValue: Math.round(Number(r.avgValue) * 100) / 100,
  }));
}

export async function viewHighValue(organizationId: string | undefined, threshold: number) {
  const rows = await queryView<any>(
    `SELECT "employee", "lineManager", "department", "type", "counterparty", "value", "date", "status"` +
      ` FROM "v_high_value_declarations" WHERE "value" >= ?` +
      (organizationId ? ` AND "organizationId" = ?` : ` `) +
      ` ORDER BY "employee" ASC, "value" DESC`,
    organizationId ? [threshold, organizationId] : [threshold],
  );
  return rows;
}

export async function viewSlaRows() {
  return queryView<any>(`SELECT "role", "decidedAt", "eventDate" FROM "v_workflow_step_sla"`, []);
}

export async function viewCurrentSteps(organizationId?: string) {
  return queryView<any>(
    `SELECT s."declarationId" AS "declarationId", s."stepOrder" AS "stepOrder",` +
      ` s."role" AS "role", s."assigneeId" AS "assigneeId",` +
      ` s."assigneeName" AS "assigneeName", s."status" AS "status"` +
      ` FROM "v_workflow_current_step" s JOIN "Declaration" d ON d."id" = s."declarationId"` +
      (organizationId ? ` WHERE d."organizationId" = ?` : ``),
    organizationId ? [organizationId] : [],
  );
}
