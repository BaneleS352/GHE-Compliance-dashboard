import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth";

function buildDateFilter(startDate?: string, endDate?: string): Prisma.StringFilter | undefined {
  if (!startDate && !endDate) return undefined;
  const f: Prisma.StringFilter = {};
  if (startDate) f.gte = startDate;
  if (endDate) f.lte = endDate;
  return f;
}

function buildWhere(req: AuthRequest): Prisma.DeclarationWhereInput {
  const { startDate, endDate, department, status } = req.query;
  const where: Prisma.DeclarationWhereInput = {};
  const dateFilter = buildDateFilter(startDate as string, endDate as string);
  if (dateFilter) where.date = dateFilter;
  if (department && department !== "All Departments") where.department = String(department);
  if (status && status !== "All Statuses") where.status = String(status);
  return where;
}

export async function getStatusBreakdown(req: AuthRequest): Promise<Record<string, number>> {
  const where = buildWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { status: true } });

  const counts: Record<string, number> = {};
  for (const d of declarations) {
    counts[d.status] = (counts[d.status] || 0) + 1;
  }

  return counts;
}

export async function getSLABreakdown(req: AuthRequest): Promise<any[]> {
  const where = buildWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { id: true, date: true } });

  const roleMap: Record<string, string> = {
    lineManager: "Line Manager",
    hr: "HR",
    ceo: "CEO",
  };

  const byRole: Record<string, number[]> = {};

  for (const d of declarations) {
    const instance = await prisma.workflowInstance.findUnique({ where: { declarationId: d.id } });
    if (!instance) continue;
    const steps: any[] = JSON.parse(instance.steps);
    for (const step of steps) {
      if (!step.decidedAt || !d.date) continue;
      const decided = new Date(step.decidedAt).getTime();
      const submitted = new Date(d.date).getTime();
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
  const where = buildWhere(req);
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
  const where = buildWhere(req);
  where.value = { gt: config.highValueThreshold };

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { value: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, date: true, status: true,
    },
  });

  return declarations;
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
  const where = buildWhere(req);
  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submitted: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, submitted: true, status: true,
    },
  });

  return declarations;
}