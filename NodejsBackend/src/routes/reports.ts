import { Router, Response } from "express";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { generateExcelBuffer, ColumnDef } from "../services/excelService";
import { getStatusBreakdown, getSLABreakdown, getHighValueDeclarations, getCounterpartyConcentration, buildReportWhere } from "../services/reports";

const router = Router();

router.get("/counterparty-concentration", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await getCounterpartyConcentration(req);
  res.json(data);
}));

router.get("/status-breakdown", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await getStatusBreakdown(req);
  res.json(data);
}));

router.get("/sla", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const data = await getSLABreakdown(req);
  res.json(data);
}));

router.get("/high-value", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const config = await prisma.systemConfig.findFirst();
  const threshold = config?.highValueThreshold ?? 1000;
  const data = await getHighValueDeclarations(req, { highValueThreshold: threshold });
  res.json(data);
}));

router.get("/list", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where = buildReportWhere(req);
  const search = req.query.search as string | undefined;

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: { snapshot: true, counterpartyRef: true },
  });

  let result = (declarations as any[]).map((d) => ({
    id: d.id,
    employee: d.snapshot?.declarerName || "",
    department: d.snapshot?.department || "",
    type: d.type,
    counterparty: d.counterpartyRef?.name || "Unknown",
    value: d.value,
    date: d.eventDate ? new Date(d.eventDate).toISOString().slice(0, 10) : "",
    submitted: d.submittedAt ? new Date(d.submittedAt).toISOString().slice(0, 10) : "",
    status: d.status,
  }));
  if (search) {
    const q = String(search).toLowerCase();
    result = result.filter((d) => String(d.employee || "").toLowerCase().includes(q) || String(d.id || "").toLowerCase().includes(q));
  }

  res.json(result);
}));

router.get("/export", authenticate, authorize("admin", "approver"), asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const where = buildReportWhere(req);
  const { reportType } = req.query;

  const declarations = await prisma.declaration.findMany({
    where,
    orderBy: { submittedAt: "desc" },
    include: { snapshot: true, counterpartyRef: true },
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

  const rows = (declarations as any[]).map((d) => ({
    id: d.id,
    employee: d.snapshot?.declarerName || "",
    department: d.snapshot?.department || "",
    type: d.type,
    counterparty: d.counterpartyRef?.name || "Unknown",
    value: d.value,
    status: d.status,
    date: d.eventDate ? new Date(d.eventDate).toISOString().slice(0, 10) : "",
  }));
  const { department, status } = req.query;
  const meta: [string, string][] = [["Generated", new Date().toISOString()], ["Records", String(rows.length)]];
  if (department && department !== "All Departments") meta.push(["Department", String(department)]);
  if (status && status !== "All Statuses") meta.push(["Status", String(status)]);

  const buffer = generateExcelBuffer({ fileName, title, columns, rows, meta });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(buffer);
}));

export default router;
