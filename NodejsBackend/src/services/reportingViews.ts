import { prisma } from "../config/prisma";

/**
 * Reporting read models (numeric identifier cutover complete).
 *
 * Views are read models, not replacements for transactional tables or
 * authorization. API authorization, organisation scoping, and parameter
 * validation remain required.
 *
 * DDL ownership: views are owned by versioned migrations
 * (0006_numeric_keys); the application role needs only SELECT. PostgreSQL is
 * the only supported provider, so queries use `$1..$n` positional parameters
 * directly. Raw driver numerics (BIGINT counts arrive as JS bigint) are
 * converted with Number() before reaching res.json.
 */

// Boundary label: raw SQL view reads. The driver returns untyped rows, so
// every view function below maps to an explicit row type at this boundary;
// callers never cast view results.
async function queryView<T>(sql: string, params: unknown[]): Promise<T[] | null> {
  try {
    return await prisma.$queryRawUnsafe(sql, ...params);
  } catch {
    return null;
  }
}

// Raw driver row: all columns arrive driver-typed (BigInt numerics, Date or
// ISO strings for timestamps). Converters below normalize at the boundary.
type RawRow = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === "bigint" ? Number(v) : Number(v);
}

function str(v: unknown): string {
  return String(v);
}

export async function viewStatusSummary(organizationId?: bigint | number) {
  const rows = await viewStatusSummaryFull(organizationId);
  if (!rows) return null;
  const out: Record<string, number> = {};
  // Unscoped queries return one row per (organisation, status) — sum across
  // organisations so callers get global totals, not the last org's row.
  for (const r of rows) out[r.status] = (out[r.status] || 0) + Number(r.count);
  return out;
}

/** Status rows with value totals (powers the dashboard KPIs). */
export async function viewStatusSummaryFull(organizationId?: bigint | number): Promise<{ status: string; count: number; totalValue: number }[] | null> {
  const rows = await queryView<RawRow>(
    `SELECT "status" AS "status", "count" AS "count", "totalValue" AS "totalValue" FROM "v_declaration_status_summary"` +
      (organizationId !== undefined && organizationId !== null ? ` WHERE "organizationId" = $1` : ""),
    organizationId !== undefined && organizationId !== null ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({ status: String(r.status), count: Number(r.count), totalValue: Number(r.totalValue) }));
}

export async function viewMonthly(organizationId?: bigint | number) {
  const scoped = organizationId !== undefined && organizationId !== null;
  const rows = await queryView<RawRow>(
    `SELECT "month" AS "month", "count" AS "count", "approved" AS "approved",` +
      ` "declined" AS "declined", "totalValue" AS "totalValue" FROM "v_declarations_monthly"` +
      (scoped ? ` WHERE "organizationId" = $1 ORDER BY "month" ASC` : ` ORDER BY "month" ASC`),
    scoped ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({
    month: String(r.month),
    count: Number(r.count),
    approved: Number(r.approved),
    declined: Number(r.declined),
    totalValue: Number(r.totalValue),
  }));
}

export async function viewTypeBreakdown(organizationId?: bigint | number) {
  const scoped = organizationId !== undefined && organizationId !== null;
  const rows = await queryView<RawRow>(
    `SELECT "type" AS "type", "count" AS "count", "totalValue" AS "totalValue"` +
      ` FROM "v_declaration_type_breakdown"` +
      (scoped ? ` WHERE "organizationId" = $1` : ""),
    scoped ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({ type: String(r.type), count: Number(r.count), totalValue: Number(r.totalValue) }));
}

export async function viewCounterparty(organizationId?: bigint | number) {
  const scoped = organizationId !== undefined && organizationId !== null;
  const rows = await queryView<RawRow>(
    `SELECT "counterparty" AS "counterparty", "count" AS "count",` +
      ` "totalValue" AS "totalValue", "avgValue" AS "avgValue"` +
      ` FROM "v_counterparty_concentration"` +
      (scoped ? ` WHERE "organizationId" = $1 ORDER BY "totalValue" DESC` : ` ORDER BY "totalValue" DESC`),
    scoped ? [organizationId] : [],
  );
  if (!rows) return null;
  const mapped = rows.map((r) => ({
    counterparty: String(r.counterparty),
    count: Number(r.count),
    totalValue: Number(r.totalValue),
    avgValue: Math.round(Number(r.avgValue) * 100) / 100,
  }));
  if (scoped) return mapped;
  // Unscoped queries return one row per (organisation, counterparty) —
  // merge across organisations so totals are global, not per-org fragments.
  const merged = new Map<string, { count: number; totalValue: number }>();
  for (const m of mapped) {
    const e = merged.get(m.counterparty) || { count: 0, totalValue: 0 };
    e.count += m.count;
    e.totalValue += m.totalValue;
    merged.set(m.counterparty, e);
  }
  return [...merged.entries()]
    .map(([counterparty, d]) => ({
      counterparty,
      count: d.count,
      totalValue: d.totalValue,
      avgValue: Math.round((d.totalValue / d.count) * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);
}

export interface HighValueRow {
  employee: string;
  lineManager: string;
  department: string;
  type: string;
  counterparty: string;
  value: number;
  date: string;
  status: string;
}

export async function viewHighValue(organizationId: bigint | number | undefined, threshold: number): Promise<HighValueRow[] | null> {
  const scoped = organizationId !== undefined && organizationId !== null;
  const rows = await queryView<RawRow>(
    `SELECT "employee", "lineManager", "department", "type", "counterparty", "value", "date", "status"` +
      ` FROM "v_high_value_declarations" WHERE "value" >= $1` +
      (scoped ? ` AND "organizationId" = $2` : ` `) +
      ` ORDER BY "employee" ASC, "value" DESC`,
    scoped ? [threshold, organizationId] : [threshold],
  );
  if (!rows) return null;
  return rows.map((r) => ({
    employee: str(r.employee),
    lineManager: str(r.lineManager),
    department: str(r.department),
    type: str(r.type),
    counterparty: str(r.counterparty),
    value: num(r.value),
    date: str(r.date),
    status: str(r.status),
  }));
}

export interface SlaRow {
  role: string;
  decidedAt: string | Date | null;
  eventDate: string | Date | null;
}

export async function viewSlaRows(): Promise<SlaRow[] | null> {
  const rows = await queryView<RawRow>(`SELECT "role", "decidedAt", "eventDate" FROM "v_workflow_step_sla"`, []);
  if (!rows) return null;
  return rows.map((r) => ({
    role: str(r.role),
    decidedAt: (r.decidedAt ?? null) as SlaRow["decidedAt"],
    eventDate: (r.eventDate ?? null) as SlaRow["eventDate"],
  }));
}

export async function viewCurrentSteps(organizationId?: bigint | number) {
  const scoped = organizationId !== undefined && organizationId !== null;
  const rows = await queryView<RawRow>(
    `SELECT d."id" AS "declarationId", s."stepOrder" AS "stepOrder",` +
      ` s."role" AS "role", s."assigneeId" AS "assigneeId",` +
      ` s."assigneeName" AS "assigneeName", s."status" AS "status"` +
      ` FROM "v_workflow_current_step" s JOIN "Declaration" d ON d."declarationPk" = s."declarationPk"` +
      (scoped ? ` WHERE d."organizationId" = $1` : ``),
    scoped ? [organizationId] : [],
  );
  if (!rows) return null;
  return rows.map((r) => ({
    declarationId: String(r.declarationId),
    stepOrder: Number(r.stepOrder),
    role: String(r.role),
    assigneeId: r.assigneeId === null || r.assigneeId === undefined ? null : Number(r.assigneeId),
    assigneeName: String(r.assigneeName),
    status: String(r.status),
  }));
}
