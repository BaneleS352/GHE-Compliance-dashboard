import { Router, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import { prisma } from "../config/prisma";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { generateExcelBuffer, ColumnDef } from "../services/excelService";
import {
  detectKind,
  protectDocumentBytes,
  validateExportPassword,
} from "../services/documentProtection";
import { getStatusBreakdown, getSLABreakdown, getHighValueDeclarations, getCounterpartyConcentration, buildReportWhere } from "../services/reports";

const router = Router();

// In-memory only: unprotected export bytes must never touch disk.
const protectUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

function safeExportFilename(raw: unknown, ext: string): string {
  const base = String(raw || "")
    .split(/[/\\]/)
    .pop()!
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);
  const stem = base.replace(/\.[A-Za-z0-9]+$/, "") || "document";
  return `protected-${stem}.${ext}`;
}

// POST /api/reports/protect-document — password-protect one explicitly
// exported document (report PDF or Excel). Any authenticated user may protect
// their own exports (team members export from My Declarations). The password
// is downloader-set per export, travels in the POST body only, and is never
// stored or logged. Failures never return an unprotected copy: validation
// problems are 400/415, missing server tooling is 503, encryption errors
// are 502.
router.post(
  "/protect-document",
  authenticate,
  protectUpload.single("file"),
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const passwordError = validateExportPassword(req.body?.password);
    if (passwordError) {
      res.status(400).json({ error: passwordError });
      return;
    }
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file || file.size === 0) {
      res.status(400).json({ error: "An export file is required." });
      return;
    }
    const kind = detectKind(file.buffer);
    if (!kind) {
      res
        .status(415)
        .json({ error: "Only PDF and Excel (.xlsx) exports can be password-protected." });
      return;
    }
    try {
      const protectedBytes = await protectDocumentBytes(kind, file.buffer, String(req.body.password));
      res.setHeader(
        "Content-Type",
        kind === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeExportFilename(req.body?.filename, kind === "pdf" ? "pdf" : "xlsx")}"`,
      );
      res.send(Buffer.from(protectedBytes));
    } catch (err: unknown) {
      const statusCode =
        typeof (err as { statusCode?: unknown }).statusCode === "number"
          ? (err as { statusCode: number }).statusCode
          : 502;
      res
        .status(statusCode)
        .json({ error: err instanceof Error ? err.message : "Document protection failed." });
    }
  }),
);

// Multer errors surface as JSON (not HTML/crash): oversized files are 413.
router.use((err: Error, _req: AuthRequest, res: Response, next: NextFunction): void => {
  if (err instanceof MulterError) {
    res.status(err.code === "LIMIT_FILE_SIZE" ? 413 : 400).json({ error: "Export file rejected." });
    return;
  }
  next(err);
});

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

  let result = declarations.map((d) => ({
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

  const rows = declarations.map((d) => ({
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
