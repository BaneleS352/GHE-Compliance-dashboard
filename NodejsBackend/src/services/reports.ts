import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { parseDateSafe } from "./normalization";
import { toDbId } from "./ids";
import { viewStatusSummary, viewSlaRows, viewCounterparty } from "./reportingViews";

const REPORT_BATCH_SIZE = 500;

/**
 * Canonical date filter on the `eventDate` DateTime column.
 * Unparseable bounds are ignored; rows with a null `eventDate` are excluded
 * from date-filtered queries.
 */
function buildDateFilter(startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
  if (!startDate && !endDate) return undefined;
  const f: Prisma.DateTimeFilter = {};
  const start = parseDateSafe(startDate);
  if (start) f.gte = start;
  let end = parseDateSafe(endDate);
  if (end && endDate && /^\d{4}-\d{2}-\d{2}$/.test(String(endDate).trim())) {
    // A calendar-date upper bound is inclusive of the whole day (UTC).
    end = new Date(end.getTime());
    end.setUTCHours(23, 59, 59, 999);
  }
  if (end) f.lte = end;
  return Object.keys(f).length > 0 ? f : undefined;
}

export function buildReportWhere(req: AuthRequest): Prisma.DeclarationWhereInput {
  const { startDate, endDate, department, status } = req.query;
  const where: Prisma.DeclarationWhereInput = {};
  const dateFilter = buildDateFilter(startDate as string, endDate as string);
  if (dateFilter) where.eventDate = dateFilter;
  if (department && department !== "All Departments") {
    where.snapshot = { department: String(department) };
  }
  if (status && status !== "All Statuses") {
    const validStatuses = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"];
    // An explicitly invalid filter must not silently become an unfiltered query.
    where.status = validStatuses.includes(String(status)) ? String(status) : "__invalid_status__";
  }
  // Org isolation
  const orgId = req.user?.organizationId ?? undefined;
  if (orgId !== undefined && orgId !== null) where.organizationId = toDbId(orgId);
  return where;
}

export async function getStatusBreakdown(req: AuthRequest): Promise<Record<string, number>> {
  // Prefer the reporting view; fall back to direct aggregation.
  try {
    const orgId = req.user?.organizationId ?? undefined;
    const fromView = await viewStatusSummary(orgId ?? undefined);
    if (fromView) {
      // Views are unfiltered read models — re-apply non-org filters via the
      // filtered path when present.
      const { startDate, endDate, department, status } = req.query;
      if (!startDate && !endDate && !department && !status) return fromView;
    }
  } catch {
    // Fall through to direct aggregation.
  }
  const where = buildReportWhere(req);
  const grouped = await prisma.declaration.groupBy({ by: ["status"], where, _count: { status: true } });
  const counts: Record<string, number> = {};
  for (const g of grouped) {
    counts[g.status] = g._count.status;
  }
  return counts;
}

export async function getSLABreakdown(req: AuthRequest): Promise<any[]> {
  // Prefer relational step rows via the SLA view (portable day math in JS).
  // Views are unfiltered read models: only use them when the request carries no
  // report filters, otherwise fall through to the filtered aggregation.
  const { startDate, endDate, department, status } = req.query as Record<string, unknown>;
  const unfiltered = !startDate && !endDate && (!department || department === "All Departments") && (!status || status === "All Statuses");
  if (unfiltered) {
    try {
      // Scope like every other view-backed report: global callers (admin,
      // org-less) see all rows; org-scoped callers see only their own.
      const orgId = req.user?.organizationId ?? undefined;
      const rows = await viewSlaRows(orgId ?? undefined);
      if (rows && rows.length > 0) {
        const roleMap: Record<string, string> = { lineManager: "Line Manager", hr: "HR" };
        const byRole: Record<string, number[]> = {};
        for (const r of rows) {
          if (!r.decidedAt || !r.eventDate) continue;
          const decided = new Date(r.decidedAt).getTime();
          const base = new Date(r.eventDate).getTime();
          if (Number.isNaN(decided) || Number.isNaN(base)) continue;
          const days = (decided - base) / (1000 * 60 * 60 * 24);
          const label = roleMap[r.role] || r.role;
          if (!byRole[label]) byRole[label] = [];
          byRole[label].push(days);
        }
        const out = Object.entries(byRole).map(([role, days]) => {
          const total = days.reduce((s, d) => s + d, 0);
          return {
            role,
            avg: Math.round((total / days.length) * 100) / 100,
            min: Math.round(Math.min(...days) * 100) / 100,
            max: Math.round(Math.max(...days) * 100) / 100,
            count: days.length,
          };
        });
        if (out.length > 0) return out;
      }
    } catch {
      // Fall through to direct aggregation.
    }
  }
  const where = buildReportWhere(req);
  const roleMap: Record<string, string> = {
    lineManager: "Line Manager",
    hr: "HR",
  };
  const byRole: Record<string, { total: number; min: number; max: number; count: number }> = {};
  let cursor: bigint | undefined;
  while (true) {
    const declarations = await prisma.declaration.findMany({
      where,
      orderBy: { declarationPk: "asc" },
      take: REPORT_BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor: { declarationPk: cursor }, skip: 1 }),
      select: { declarationPk: true, eventDate: true },
    });
    if (declarations.length === 0) break;
    cursor = declarations[declarations.length - 1].declarationPk;
    const pks = declarations.map((d) => d.declarationPk);
    const declarationByPk = new Map(declarations.map((d) => [String(d.declarationPk), d]));
    const stepRows = await prisma.workflowInstanceStep.findMany({
      where: { declarationPk: { in: pks }, decidedAt: { not: null } },
      select: { declarationPk: true, role: true, decidedAt: true },
    });
    for (const step of stepRows) {
      const declaration = declarationByPk.get(String(step.declarationPk));
      if (!declaration?.eventDate || !step.decidedAt) continue;
      const decided = new Date(step.decidedAt).getTime();
      const base = new Date(declaration.eventDate).getTime();
      if (Number.isNaN(decided) || Number.isNaN(base)) continue;
      const days = (decided - base) / (1000 * 60 * 60 * 24);
      const role = roleMap[step.role] || step.role;
      const aggregate = byRole[role] || { total: 0, min: days, max: days, count: 0 };
      aggregate.total += days;
      aggregate.min = Math.min(aggregate.min, days);
      aggregate.max = Math.max(aggregate.max, days);
      aggregate.count += 1;
      byRole[role] = aggregate;
    }
    if (declarations.length < REPORT_BATCH_SIZE) break;
  }

  return Object.entries(byRole).map(([role, aggregate]) => ({
    role,
    avg: Math.round((aggregate.total / aggregate.count) * 100) / 100,
    min: Math.round(aggregate.min * 100) / 100,
    max: Math.round(aggregate.max * 100) / 100,
    count: aggregate.count,
  }));
}

export async function getCounterpartyConcentration(req: AuthRequest): Promise<any[]> {
  // Prefer the reporting view for unfiltered org queries.
  try {
    const { startDate, endDate, department, status } = req.query;
    if (!startDate && !endDate && !department && !status) {
      const orgId = req.user?.organizationId ?? undefined;
      const fromView = await viewCounterparty(orgId ?? undefined);
      if (fromView) return fromView;
    }
  } catch {
    // Fall through to direct aggregation.
  }
  const where = buildReportWhere(req);
  const groups: Record<string, { count: number; totalValue: number }> = {};
  let cursor: bigint | undefined;
  while (true) {
    const declarations = await prisma.declaration.findMany({
      where,
      orderBy: { declarationPk: "asc" },
      take: REPORT_BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor: { declarationPk: cursor }, skip: 1 }),
      select: { declarationPk: true, value: true, counterpartyRef: { select: { name: true } } },
    });
    if (declarations.length === 0) break;
    cursor = declarations[declarations.length - 1].declarationPk;
    for (const declaration of declarations) {
      const key = declaration.counterpartyRef?.name || "Unknown";
      if (!groups[key]) groups[key] = { count: 0, totalValue: 0 };
      groups[key].count++;
      groups[key].totalValue += Number(declaration.value);
    }
    if (declarations.length < REPORT_BATCH_SIZE) break;
  }

  const result = Object.entries(groups)
    .map(([counterparty, data]) => ({
      counterparty,
      count: data.count,
      totalValue: data.totalValue,
      avgValue: Math.round((data.totalValue / data.count) * 100) / 100,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return result;
}

interface HighValueGroup {
  employee: string;
  lineManager: string;
  declarationCount: number;
  totalValue: number;
  averageValue: number;
  totalGift: number;
  totalHospitality: number;
  totalEntertainment: number;
  suppliers: Map<string, number>;
}

export async function getHighValueDeclarations(req: AuthRequest, config: { highValueThreshold: number }): Promise<any[]> {
  const where = buildReportWhere(req);
  where.value = { gte: config.highValueThreshold };

  const groups = new Map<string, HighValueGroup>();
  let cursor: bigint | undefined;
  while (true) {
    const declarations = await prisma.declaration.findMany({
      where,
      orderBy: { declarationPk: "asc" },
      take: REPORT_BATCH_SIZE,
      ...(cursor === undefined ? {} : { cursor: { declarationPk: cursor }, skip: 1 }),
      include: { snapshot: true, counterpartyRef: true },
    });
    if (declarations.length === 0) break;
    cursor = declarations[declarations.length - 1].declarationPk;
    for (const d of declarations) {
      const employee = d.snapshot?.declarerName || "Unknown";
      const row = groups.get(employee) || {
        employee,
        lineManager: d.snapshot?.managerDisplayName || "",
        declarationCount: 0,
        totalValue: 0,
        averageValue: 0,
        totalGift: 0,
        totalHospitality: 0,
        totalEntertainment: 0,
        suppliers: new Map<string, number>(),
      };
      row.declarationCount += 1;
      row.totalValue += Number(d.value);
      if (d.type === "Gift") row.totalGift += Number(d.value);
      if (d.type === "Hospitality") row.totalHospitality += Number(d.value);
      if (d.type === "Entertainment") row.totalEntertainment += Number(d.value);
      const cp = d.counterpartyRef?.name || "Unknown";
      row.suppliers.set(cp, (row.suppliers.get(cp) || 0) + 1);
      groups.set(employee, row);
    }
    if (declarations.length < REPORT_BATCH_SIZE) break;
  }

  return [...groups.values()].map((row) => {
    const mostFrequentSupplier = [...row.suppliers.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "Unknown";
    return {
      employee: row.employee,
      lineManager: row.lineManager,
      declarationCount: row.declarationCount,
      totalValue: row.totalValue,
      averageValue: Math.round((row.totalValue / row.declarationCount) * 100) / 100,
      totalGift: row.totalGift,
      totalHospitality: row.totalHospitality,
      totalEntertainment: row.totalEntertainment,
      mostFrequentSupplier,
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

export async function getReportsData(req: AuthRequest, config: { highValueThreshold: number }): Promise<any> {
  const [statusBreakdown, slaData, counterpartyData, highValueData] = await Promise.all([
    getStatusBreakdown(req),
    getSLABreakdown(req),
    getCounterpartyConcentration(req),
    getHighValueDeclarations(req, config),
  ]);

  return {
    statusBreakdown,
    slaData,
    counterpartyData,
    highValueData,
  };
}
