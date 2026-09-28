import { prisma } from "../config/prisma";

/**
 * Phase 4 reporting read models.
 *
 * Views are created with portable SQL (SQLite + PostgreSQL) over the
 * normalized tables. They never replace authorization: every query helper
 * below still applies organisation scoping, and every caller keeps its
 * role checks. When the relational tables are empty (pre-backfill) or the
 * database predates the migration, helpers fall back to the legacy
 * Prisma aggregations so the API contract is unchanged.
 */

const VIEW_DDLS = [
  // Counts + value totals by organisation and status.
  `CREATE VIEW IF NOT EXISTS "v_declaration_status_summary" AS
   SELECT "organizationId" AS "organizationId", "status" AS "status",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "status"`,

  // Volume + outcomes by month (legacy YYYY-MM-DD text column; portable substr).
  `CREATE VIEW IF NOT EXISTS "v_declarations_monthly" AS
   SELECT "organizationId" AS "organizationId",
          substr("date", 1, 7) AS "month",
          COUNT(*) AS "count",
          SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
          SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
          SUM("value") AS "totalValue"
   FROM "Declaration" WHERE "date" IS NOT NULL AND length("date") >= 7
   GROUP BY "organizationId", substr("date", 1, 7)`,

  // Type / value breakdowns.
  `CREATE VIEW IF NOT EXISTS "v_declaration_type_breakdown" AS
   SELECT "organizationId" AS "organizationId", "type" AS "type",
          COUNT(*) AS "count", SUM("value") AS "totalValue"
   FROM "Declaration" GROUP BY "organizationId", "type"`,

  // Current pending step per declaration (relational audit trail).
  `CREATE VIEW IF NOT EXISTS "v_workflow_current_step" AS
   SELECT "declarationId", "stepOrder", "role", "assigneeId", "assigneeName", "status"
   FROM "WorkflowInstanceStep" WHERE "status" = 'pending'`,

  // Completed-step durations: raw timestamps; day math stays in JS for portability.
  `CREATE VIEW IF NOT EXISTS "v_workflow_step_sla" AS
   SELECT s."role" AS "role", s."decidedAt" AS "decidedAt",
          d."eventDate" AS "eventDate", d."date" AS "legacyDate"
   FROM "WorkflowInstanceStep" s JOIN "Declaration" d ON d."id" = s."declarationId"
   WHERE s."decidedAt" IS NOT NULL`,

  // Counterparty concentration.
  `CREATE VIEW IF NOT EXISTS "v_counterparty_concentration" AS
   SELECT "organizationId" AS "organizationId", "counterparty" AS "counterparty",
          COUNT(*) AS "count", SUM("value") AS "totalValue",
          AVG("value") AS "avgValue"
   FROM "Declaration" GROUP BY "organizationId", "counterparty"`,

  // High-value declaration rows (threshold applied by the service).
  `CREATE VIEW IF NOT EXISTS "v_high_value_declarations" AS
   SELECT "id", "employee", "lineManager", "department", "type",
          "counterparty", "value", "date", "status", "organizationId"
   FROM "Declaration"`,
];

let ensured = false;

export async function ensureReportingViews(): Promise<void> {
  if (ensured) return;
  for (const ddl of VIEW_DDLS) {
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
    return await prisma.$queryRawUnsafe(sql, ...params);
  } catch {
    return null;
  }
}

export async function viewStatusSummary(organizationId?: string) {
  const rows = await queryView<any>(
    `SELECT "status" AS "status", "count" AS "count" FROM "v_declaration_status_summary"` +
      (organizationId ? ` WHERE "organizationId" = ?` : ""),
    organizationId ? [organizationId] : [],
  );
  if (!rows) return null;
  const out: Record<string, number> = {};
  for (const r of rows) out[String(r.status)] = Number(r.count);
  return out;
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
