import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { generateExcelBuffer, ColumnDef } from "../services/excelService";

const router = Router();

// GET /api/reports/status-breakdown
router.get("/status-breakdown", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, department, status } = req.query;
  let declarations = await prisma.declaration.findMany();

  if (startDate) declarations = declarations.filter((d) => d.date >= String(startDate));
  if (endDate) declarations = declarations.filter((d) => d.date <= String(endDate));
  if (department && department !== "All Departments") declarations = declarations.filter((d) => d.department === String(department));
  if (status && status !== "All Statuses") declarations = declarations.filter((d) => d.status === String(status));

  const counts: Record<string, number> = {};
  for (const d of declarations) {
    counts[d.status] = (counts[d.status] || 0) + 1;
  }

  res.json(counts);
});

// GET /api/reports/sla
router.get("/sla", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, department, status } = req.query;
  let declarations = await prisma.declaration.findMany();

  if (startDate) declarations = declarations.filter((d) => d.date >= String(startDate));
  if (endDate) declarations = declarations.filter((d) => d.date <= String(endDate));
  if (department && department !== "All Departments") declarations = declarations.filter((d) => d.department === String(department));
  if (status && status !== "All Statuses") declarations = declarations.filter((d) => d.status === String(status));

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

  res.json(slaData);
});

// GET /api/reports/counterparty-concentration
router.get("/counterparty-concentration", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, department, status } = req.query;
  let declarations = await prisma.declaration.findMany();

  if (startDate) declarations = declarations.filter((d) => d.date >= String(startDate));
  if (endDate) declarations = declarations.filter((d) => d.date <= String(endDate));
  if (department && department !== "All Departments") declarations = declarations.filter((d) => d.department === String(department));
  if (status && status !== "All Statuses") declarations = declarations.filter((d) => d.status === String(status));

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

// GET /api/reports/high-value — declarations above threshold
router.get("/high-value", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const config = await prisma.systemConfig.findFirst();
  const threshold = config?.highValueThreshold || 2000;

  const declarations = await prisma.declaration.findMany({
    where: { value: { gt: threshold } },
    orderBy: { value: "desc" },
  });

  res.json(
    declarations.map((d) => ({
      id: d.id,
      employee: d.employee,
      department: d.department,
      type: d.type,
      counterparty: d.counterparty,
      value: d.value,
      submitted: d.submitted,
      status: d.status,
    }))
  );
});

// GET /api/reports/list — filtered declaration list for results table
router.get("/list", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, department, status, search } = req.query;
  let declarations = await prisma.declaration.findMany({ orderBy: { submitted: "desc" } });

  if (startDate) declarations = declarations.filter((d) => d.date >= String(startDate));
  if (endDate) declarations = declarations.filter((d) => d.date <= String(endDate));
  if (department && department !== "All Departments") declarations = declarations.filter((d) => d.department === String(department));
  if (status && status !== "All Statuses") declarations = declarations.filter((d) => d.status === String(status));
  if (search) {
    const q = String(search).toLowerCase();
    declarations = declarations.filter((d) => d.employee.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }

  res.json(
    declarations.map((d) => ({
      id: d.id,
      employee: d.employee,
      department: d.department,
      type: d.type,
      counterparty: d.counterparty,
      value: d.value,
      submitted: d.submitted,
      status: d.status,
    }))
  );
});

// GET /api/reports/export — Excel download
router.get("/export", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const { startDate, endDate, department, status, reportType } = req.query;
  let declarations = await prisma.declaration.findMany({ orderBy: { submitted: "desc" } });

  if (startDate) declarations = declarations.filter((d) => d.date >= String(startDate));
  if (endDate) declarations = declarations.filter((d) => d.date <= String(endDate));
  if (department && department !== "All Departments") declarations = declarations.filter((d) => d.department === String(department));
  if (status && status !== "All Statuses") declarations = declarations.filter((d) => d.status === String(status));

  const title = String(reportType || "Declaration Report");
  const sanitized = title.replace(/[^a-zA-Z0-9]/g, "_");
  const today = new Date().toISOString().slice(0, 10);
  const fileName = `${sanitized}_${today}.xlsx`;

  const columns: ColumnDef[] = [
    { header: "ID", key: "id", width: 18 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Department", key: "department", width: 16 },
    { header: "Type", key: "type", width: 14 },
    { header: "Counterparty", key: "counterparty", width: 22 },
    { header: "Value", key: "value", width: 12 },
    { header: "Status", key: "status", width: 14 },
    { header: "Date", key: "submitted", width: 14 },
  ];

  const rows = declarations.map((d) => ({
    id: d.id,
    employee: d.employee,
    department: d.department,
    type: d.type,
    counterparty: d.counterparty,
    value: d.value,
    status: d.status,
    submitted: d.submitted,
  }));

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
