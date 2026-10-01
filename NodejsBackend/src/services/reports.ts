import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";
import { parseDateSafe } from "./normalization";
import { viewStatusSummary, viewSlaRows, viewCounterparty } from "./reportingViews";

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
  const orgId = (req as any).user?.organizationId as number | undefined;
  if (orgId !== undefined && orgId !== null) (where as any).organizationId = orgId;
  return where;
}

export async function getStatusBreakdown(req: AuthRequest): Promise<Record<string, number>> {
  // Prefer the reporting view; fall back to direct aggregation.
  try {
    const orgId = (req as any).user?.organizationId as number | undefined;
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
      const rows = await viewSlaRows();
      if (rows && rows.length > 0) {
        const roleMap: Record<string, string> = { lineManager: "Line Manager", hr: "HR" };
        const byRole: Record<string, number[]> = {};
        for (const r of rows as any[]) {
          const decidedRaw = (r as any).decidedAt;
          const eventRaw = (r as any).eventDate;
          if (!decidedRaw || !eventRaw) continue;
          const decided = new Date(decidedRaw).getTime();
          const base = new Date(eventRaw).getTime();
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
      // Fall through to direct aggregation.
    }
  }
  const where = buildReportWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { declarationPk: true, eventDate: true } });
  if (declarations.length === 0) return [];

  const roleMap: Record<string, string> = {
    lineManager: "Line Manager",
    hr: "HR",
  };

  const pks = declarations.map((d) => d.declarationPk);
  const stepRows = await prisma.workflowInstanceStep.findMany({
    where: { declarationPk: { in: pks }, decidedAt: { not: null } },
    select: { declarationPk: true, role: true, decidedAt: true },
  });
  const declMap = new Map(declarations.map((d) => [String(d.declarationPk), d]));

  const byRole: Record<string, number[]> = {};
  for (const s of stepRows as any[]) {
    const d = declMap.get(String(s.declarationPk)) as any;
    if (!d || !d.eventDate || !s.decidedAt) continue;
    const decided = new Date(s.decidedAt).getTime();
    const base = new Date(d.eventDate).getTime();
    if (Number.isNaN(decided) || Number.isNaN(base)) continue;
    const days = (decided - base) / (1000 * 60 * 60 * 24);
    const label = roleMap[s.role] || s.role;
    if (!byRole[label]) byRole[label] = [];
    byRole[label].push(days);
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
  // Prefer the reporting view for unfiltered org queries.
  try {
    const { startDate, endDate, department, status } = req.query;
    if (!startDate && !endDate && !department && !status) {
      const orgId = (req as any).user?.organizationId as number | undefined;
      const fromView = await viewCounterparty(orgId ?? undefined);
      if (fromView) return fromView;
    }
  } catch {
    // Fall through to direct aggregation.
  }
  const where = buildReportWhere(req);
  const declarations = await prisma.declaration.findMany({
    where,
    select: { value: true, counterpartyRef: { select: { name: true } } },
  });

  const groups: Record<string, { count: number; totalValue: number }> = {};
  for (const d of declarations as any[]) {
    const key = d.counterpartyRef?.name || "Unknown";
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
    orderBy: [{ value: "desc" }],
    include: {
      snapshot: true,
      counterpartyRef: true,
    },
  });

  const groups = new Map<string, any>();
  for (const d of declarations as any[]) {
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
    row.totalValue += d.value;
    if (d.type === "Gift") row.totalGift += d.value;
    if (d.type === "Hospitality") row.totalHospitality += d.value;
    if (d.type === "Entertainment") row.totalEntertainment += d.value;
    const cp = d.counterpartyRef?.name || "Unknown";
    row.suppliers.set(cp, (row.suppliers.get(cp) || 0) + 1);
    groups.set(employee, row);
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
    include: {
      snapshot: true,
      counterpartyRef: true,
    },
  });

  return (declarations as any[]).map((d) => ({
    id: d.id,
    employee: d.snapshot?.declarerName || "",
    department: d.snapshot?.department || "",
    type: d.type,
    counterparty: d.counterpartyRef?.name || "Unknown",
    value: d.value,
    submitted: d.submittedAt ? new Date(d.submittedAt).toISOString().slice(0, 10) : "",
    status: d.status,
  }));
}
