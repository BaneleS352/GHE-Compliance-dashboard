import { Router, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { generateExcelBuffer, ColumnDef } from "../services/excelService";

const router = Router();

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

// GET /api/reports/status-breakdown
router.get("/status-breakdown", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const where = buildWhere(req);
  const declarations = await prisma.declaration.findMany({ where, select: { status: true } });

  const counts: Record<string, number> = {};
  for (const d of declarations) {
    counts[d.status] = (counts[d.status] || 0) + 1;
  }

  res.json(counts);
});

// GET /api/reports/sla
router.get("/sla", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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
    let steps: any[];
    try { steps = JSON.parse(instance.steps); } catch { continue; }
    for (const step of steps) {
      if (!step.decidedAt || !d.date) continue;
      const decided = new Date(step.decidedAt).getTime();
      if (isNaN(decided)) continue;
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

  res.json(slaData);
});

// GET /api/reports/counterparty-concentration
router.get("/counterparty-concentration", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
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

  res.json(result);
});

// GET /api/reports/high-value
router.get("/high-value", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const config = await prisma.systemConfig.findFirst();
  const threshold = config?.highValueThreshold || 2000;
  const where = buildWhere(req);
  where.value = { gt: threshold };

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { value: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, date: true, submitted: true, status: true,
    },
  });

  res.json(declarations);
});

// GET /api/reports/list
router.get("/list", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const where = buildWhere(req);
  const search = req.query.search as string | undefined;

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submitted: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, date: true, submitted: true, status: true,
    },
  });

  let result = declarations;
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((d) => d.employee.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }

  res.json(result);
});

// GET /api/reports/export — Excel download
router.get("/export", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const where = buildWhere(req);
  const { reportType } = req.query;

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submitted: "desc" },
    select: {
      id: true, employee: true, department: true, type: true,
      counterparty: true, value: true, date: true, submitted: true, status: true,
    },
  });

  const title = String(reportType || "Declaration Report");
  const sanitized = title.replace(/[^a-zA-Z0-9]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitized}_${today}.xlsx`;

  const columns: ColumnDef[] = [
    { header: "ID", key: "id", width: 16 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Department", key: "department", width: 14 },
    { header: "Type", key: "type", width: 14 },
    { header: "Counterparty", key: "counterparty", width: 22 },
    { header: "Value", key: "value", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Date", key: "date", width: 14 },
  ];

  const rows = declarations.map((d) => ({ ...d }));
  const { department, status } = req.query;

  const meta: [string, string][] = [
    ["Generated", new Date().toISOString()],
    ["Records", String(rows.length)],
  ];
  if (department && department !== "All Departments") meta.push(["Department", String(department)]);
  if (status && status !== "All Statuses") meta.push(["Status", String(status)]);

  const buffer = generateExcelBuffer({ fileName, title, columns, rows, meta });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
});

export default router;
