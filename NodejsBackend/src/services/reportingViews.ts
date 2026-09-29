import { prisma } from "../config/prisma";

/**
 * Phase 4 reporting read models.
 *
 * Single source-of-truth rule for this phase: relational rows are
 * authoritative whenever present. The legacy JSON/text columns are a
 * write-through cache maintained atomically in the same transaction as the
 * rows (see `writeWorkflowStepsTx`); they are read only as a fallback for
 * pre-backfill data. Direct database writes MUST update both stores.
 *
 * Views are read models, not replacements for transactional tables or
 * authorization. API authorization, organisation scoping, and parameter
 * validation remain required.
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

const VIEWS: { name: string; select: string; selectPg?: string }[] = [
  // Counts + value totals by organisation and status.
  {
    name: "v_declaration_status_summary",
    select: `SELECT "organizationId" AS "organizationId", "status" AS "status",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "status"`,
  },
  // Volume + outcomes by month from the canonical eventDate column.
  // Rows with an invalid legacy date (null eventDate) cannot be bucketed and
  // are excluded; they are counted in the backfill reconciliation report.
  // SQLite note: Prisma stores DateTime as INTEGER millis, so the month is
  // derived via strftime('%Y-%m', eventDate / 1000, 'unixepoch').
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
    selectPg: `SELECT "organizationId" AS "organizationId",
          to_char("eventDate", 'YYYY-MM') AS "month",
          COUNT(*) AS "count",
          SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
          SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
          SUM("value") AS "totalValue"
   FROM "Declaration" WHERE "eventDate" IS NOT NULL
   GROUP BY "organizationId", to_char("eventDate", 'YYYY-MM')`,
  },
  // Type / value breakdowns.
  {
    name: "v_declaration_type_breakdown",
    select: `SELECT "organizationId" AS "organizationId", "type" AS "type",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "type"`,
  },
  // Current pending step per declaration (relational audit trail).
  {
    name: "v_workflow_current_step",
    select: `SELECT "declarationId", "stepOrder", "role", "assigneeId", "assigneeName", "status"
   FROM "WorkflowInstanceStep" WHERE "status" = 'pending'`,
  },
  // Completed-step durations: raw timestamps; day math stays in JS for portability.
  {
    name: "v_workflow_step_sla",
    select: `SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
          d."eventDate" AS "eventDate", d."date" AS "legacyDate"
   FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."id" = s."declarationId"
   WHERE s."decidedAt" IS NOT NULL`,
  },
  // Counterparty concentration.
  {
    name: "v_counterparty_concentration",
    select: `SELECT "organizationId" AS "organizationId", "counterparty" AS "counterparty",
          COUNT(*) AS "count", SUM("value") AS "totalValue",
          AVG("value") AS "avgValue"
   FROM "Declaration" GROUP BY "organizationId", "counterparty"`,
  },
  // High-value declaration rows (threshold applied by the service).
  {
    name: "v_high_value_declarations",
    select: `SELECT "id", "employee", "lineManager", "department", "type",
          "counterparty", "value", "date", "status", "organizationId"
   FROM "Declaration"`,
  },
];

let ensured = false;

export async function ensureReportingViews(): Promise<void> {
  if (ensured) return;
  const pg = isPostgresProvider();
  for (const v of VIEWS) {
    const select = pg && v.selectPg ? v.selectPg : v.select;
    // PostgreSQL has no CREATE VIEW IF NOT EXISTS — use CREATE OR REPLACE.
    const ddl = pg
      ? `CREATE OR REPLACE VIEW "${v.name}" AS ${select}`
      : `CREATE VIEW IF NOT EXISTS "${v.name}" AS ${select}`;
    try {
      await prisma.$executeRawUnsafe(ddl);
    } catch {
      // Older database or limited permissions: callers fall back to legacy.
      break;
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
  for (const r of rows) out[r.status] = r.count;
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
  return queryView<any>(`SELECT "role", "decidedAt", "eventDate", "legacyDate" FROM "v_workflow_step_sla"`, []);
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
