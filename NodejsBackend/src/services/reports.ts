import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { parseDateSafe } from "./normalization";
import { viewStatusSummary, viewSlaRows, viewCounterparty } from "./reportingViews";

/**
 * Canonical date filter on the `eventDate` DateTime column (Phase 1 cutover).
 * Legacy `date` text is the write path for API compatibility, but every write
 * populates `eventDate` synchronously, so range queries use the typed column.
 * Unparseable bounds are ignored; rows with an invalid legacy date (null
 * `eventDate`) are excluded from date-filtered queries and counted in the
 * backfill reconciliation report (`invalidDates`).
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
  if (department && department !== "All Departments") where.department = String(department);
  if (status && status !== "All Statuses") {
    const validStatuses = ["Draft", "Pending", "Approved", "Declined", "Escalated", "Returned"];
    // An explicitly invalid filter must not silently become an unfiltered query.
    where.status = validStatuses.includes(String(status)) ? String(status) : "__invalid_status__";
  }
  // Org isolation
  const orgId = (req as any).user?.organizationId as string | undefined;
  if (orgId) (where as any).organizationId = orgId;
  return where;
}

export async function getStatusBreakdown(req: AuthRequest): Promise<Record<string, number>> {
  // Phase 4: prefer the reporting view; fall back to legacy aggregation
  // (pre-backfill or pre-migration databases, SQLite dev).
  try {
    const orgId = (req as any).user?.organizationId as string | undefined;
    const fromView = await viewStatusSummary(orgId);
    if (fromView) {
      // Views are unfiltered read models — re-apply non-org filters via legacy path when present.
      const { startDate, endDate, department, status } = req.query;
      if (!startDate && !endDate && !department && !status) return fromView;
    }
  } catch {
    // Fall through to legacy aggregation.
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
  // Phase 4: prefer relational step rows via the SLA view (portable day math in JS).
  // Views are unfiltered read models: only use them when the request carries no
  // report filters, otherwise fall through to the filtered legacy aggregation.
  const { startDate, endDate, department, status } = req.query as Record<string, unknown>;
  const unfiltered = !startDate && !endDate && (!department || department === "All Departments") && (!status || status === "All Statuses");
  if (unfiltered) {
  try {
    const rows = await viewSlaRows();
    if (rows && rows.length > 0) {
      const roleMap: Record<string, string> = { lineManager: "Line Manager", hr: "HR" };
      const byRole: Record<string, number[]> = {};
      for (const r of rows as any[]) {
        const decidedRaw = (r as any).decidedAt;
        const eventRaw = (r as any).eventDate;
        const legacyRaw = (r as any).legacyDate;
        if (!decidedRaw) continue;
        const decided = new Date(decidedRaw).getTime();
        const base = eventRaw ? new Date(eventRaw).getTime() : new Date(String(legacyRaw)).getTime();
        if (Number.isNaN(decided) || Number.isNaN(base)) continue;
        const days = (decided - base) / (1000 * 60 * 60 * 24);
        const label = roleMap[(r as any).role] || (r as any).role;
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
    // Fall through to legacy JSON aggregation.
  }
  }
  const where = buildReportWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { id: true, date: true } });
  if (declarations.length === 0) return [];

  const roleMap: Record<string, string> = {
    lineManager: "Line Manager",
    hr: "HR",
  };

  const declarationIds = declarations.map((d) => d.id);
  const instances = await prisma.workflowInstance.findMany({
    where: { declarationId: { in: declarationIds } },
  });
  const instanceMap = new Map(instances.map((inst) => [inst.declarationId, inst]));

  const byRole: Record<string, number[]> = {};
  const declMap = new Map(declarations.map((d) => [d.id, d]));

  for (const [declId, instance] of instanceMap) {
    const d = declMap.get(declId);
    if (!d || !d.date) continue;
    let steps: any[];
    try { steps = JSON.parse(instance.steps); } catch { continue; }
    for (const step of steps) {
      if (!step.decidedAt || !d.date) continue;
      const decided = new Date(step.decidedAt).getTime();
      const submitted = new Date(d.date).getTime();
      if (Number.isNaN(decided) || Number.isNaN(submitted)) continue;
      const days = (decided - submitted) / (1000 * 60 * 60 * 24);
      const label = roleMap[step.role] || step.role;
      if (!byRole[label]) byRole[label] = [];
      byRole[label].push(days);
    }
  }

  const slaData = Object.entries(byRole).map(([role, days]) => {
    const total = days.reduce((s, d) => s + d, 0);
    return {
      role,
      avg: Math.round((total / days.length) * 100) / 100,
      min: Math.round(Math.min(...days) * 100) / 100,
      max: Math.round(Math.max(...days) * 100) / 100,
      count: days.length,
    };
  });

  return slaData;
}

export async function getCounterpartyConcentration(req: AuthRequest): Promise<any[]> {
  // Phase 4: prefer the reporting view for unfiltered org queries.
  try {
    const { startDate, endDate, department, status } = req.query;
    if (!startDate && !endDate && !department && !status) {
      const orgId = (req as any).user?.organizationId as string | undefined;
      const fromView = await viewCounterparty(orgId);
      if (fromView) return fromView;
    }
  } catch {
    // Fall through to legacy aggregation.
  }
  const where = buildReportWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { counterparty: true, value: true } });

  const groups: Record<string, { count: number; totalValue: number }> = {};
  for (const d of declarations) {
    const key = d.counterparty || "Unknown";
    if (!groups[key]) groups[key] = { count: 0, totalValue: 0 };
    groups[key].count++;
    groups[key].totalValue += d.value;
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

export async function getHighValueDeclarations(req: AuthRequest, config: { highValueThreshold: number }): Promise<any[]> {
  const where = buildReportWhere(req);
  where.value = { gte: config.highValueThreshold };

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: [{ employee: "asc" }, { value: "desc" }],
    select: {
      employee: true, lineManager: true, department: true, type: true,
      counterparty: true, value: true, date: true, status: true,
    },
  });

  const groups = new Map<string, any>();
  for (const d of declarations) {
    const row = groups.get(d.employee) || {
      employee: d.employee,
      lineManager: d.lineManager,
      declarationCount: 0,
      totalValue: 0,
      averageValue: 0,
      totalGift: 0,
      totalHospitality: 0,
      totalEntertainment: 0,
      suppliers: new Map<string, number>(),
    };
    row.declarationCount += 1;
    row.totalValue += d.value;
    if (d.type === "Gift") row.totalGift += d.value;
    if (d.type === "Hospitality") row.totalHospitality += d.value;
    if (d.type === "Entertainment") row.totalEntertainment += d.value;
    row.suppliers.set(d.counterparty || "Unknown", (row.suppliers.get(d.counterparty || "Unknown") || 0) + 1);
    groups.set(d.employee, row);
  }

  return [...groups.values()].map((row) => {
    const mostFrequentSupplier = [...row.suppliers.entries()].sort((a: any, b: any) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "Unknown";
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

export async function getReports(req: AuthRequest, config: { highValueThreshold: number }): Promise<any> {
  const where = buildReportWhere(req);
  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, submitted: true, status: true,
    },
  });

  return declarations;
}
