import { Router, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { readWorkflowSteps } from "../services/normalization";

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain",
];
const ALLOWED_EXTS = new Set([".pdf",".xlsx",".xls",".docx",".doc",".jpg",".jpeg",".png",".gif",".webp",".txt"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(16).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES.includes(file.mimetype) && ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

function handleMulterError(err: Error, _req: AuthRequest, res: Response, next: NextFunction): void {  if (err instanceof MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "File too large. Maximum size is 10MB" });
      return;
    }
    res.status(400).json({ error: "File upload error" });
    return;
  }
  if (err.message && err.message.startsWith("File type")) {
    res.status(400).json({ error: "File type not allowed" });
    return;
  }
  next(err);
}

/** Rows-first assignee check; legacy JSON cache is the fallback. */
async function isWorkflowAssignee(declarationId: string, userId: string): Promise<boolean> {
  try {
    const steps = await readWorkflowSteps(declarationId);
    if (steps) return steps.some((s: any) => s.assignee === userId);
  } catch { /* fall through to JSON */ }
  const inst = await prisma.workflowInstance.findUnique({ where: { declarationId } });
  if (!inst) return false;
  try {
    const steps: any[] = JSON.parse(inst.steps as string);
    return steps.some((s: any) => s.assignee === userId);
  } catch { return false; }
}

/**
 * Resolve a stored file path strictly inside the upload directory.
 * `file.path` is database data — a tainted row must not turn serve/delete
 * into arbitrary filesystem access. Returns null when contained check fails.
 */
export function containedUploadPath(storedPath: string): string | null {
  const resolved = path.resolve(UPLOAD_DIR, storedPath);
  if (resolved !== UPLOAD_DIR && resolved.startsWith(UPLOAD_DIR + path.sep)) return resolved;
  return null;
}

// POST /api/files/upload
router.post(
  "/upload",
  authenticate,
  (req: AuthRequest, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err: unknown) => {
      if (err) { handleMulterError(err as Error, req, res, next); return; }
      next();
    });
  },
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const declarationId = req.body.declarationId as string;

    const cleanupFile = async () => {
      if (req.file) {
        const fp = containedUploadPath(req.file.filename);
        if (fp) {
          try { await fs.promises.unlink(fp); } catch {}
        }
      }
    };

    if (!declarationId) {
      await cleanupFile();
      res.status(400).json({ error: "declarationId is required" });
      return;
    }

    const decl = await prisma.declaration.findUnique({ where: { id: declarationId } });
    if (!decl) {
      await cleanupFile();
      res.status(400).json({ error: "Declaration not found" });
      return;
    }
    if (req.user!.role !== "admin" && decl.employeeId !== req.user!.id) {
      await cleanupFile();
      res.status(403).json({ error: "Cannot upload to another user's declaration" });
      return;
    }
    // Evidence is immutable after decision — same rule as PUT (Draft/Returned only).
    if (decl.status !== "Draft" && decl.status !== "Returned") {
      await cleanupFile();
      res.status(400).json({ error: "Cannot upload files to a declaration that is not a draft or returned" });
      return;
    }

    const file = await prisma.uploadedFile.create({
      data: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.filename,
        declarationId: declarationId || null,
      },
    });

    // Relational join for the auditable file association (Phase 3).
    try {
      await (prisma as any).declarationFile.create({
        data: { declarationId, fileId: file.id },
      });
    } catch {
      // Legacy UploadedFile.declarationId remains authoritative.
    }

    res.status(201).json({
      id: file.id,
      name: file.originalName,
      size: file.size,
      type: file.mimeType,
      url: `/api/files/${file.id}`,
      uploadedAt: file.uploadedAt,
    });
  })
);

// GET /api/files/:id
router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  // Ownership scoping — require admin or owner; orphan files (no declarationId) only admin can access
  if (req.user!.role !== "admin") {
    if (!file.declarationId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const decl = await prisma.declaration.findUnique({ where: { id: file.declarationId } });
    if (!decl || decl.employeeId !== req.user!.id) {
      let isApprover = false;
      if (decl) {
        isApprover = await isWorkflowAssignee(decl.id, req.user!.id);
      }
      if (!isApprover) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
  }

  const filePath = containedUploadPath(file.path);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found on disk" });
    return;
  }

  res.setHeader("Content-Type", file.mimeType);
  // Sanitize filename for Content-Disposition (prevent header injection)
  const safeName = file.originalName.replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(safeName);
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`);
  res.sendFile(filePath);
}));

// DELETE /api/files/:id
router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  // Ownership scoping — same as GET
  if (req.user!.role !== "admin") {
    if (!file.declarationId) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    const decl = await prisma.declaration.findUnique({ where: { id: file.declarationId } });
    if (!decl || decl.employeeId !== req.user!.id) {
      let isApprover = false;
      if (decl) {
        isApprover = await isWorkflowAssignee(decl.id, req.user!.id);
      }
      if (!isApprover) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
    // Evidence is immutable after decision — no deletes once Approved/Declined.
    if (decl && (decl.status === "Approved" || decl.status === "Declined")) {
      res.status(400).json({ error: "Cannot delete files from a decided declaration" });
      return;
    }
  }

  const filePath = containedUploadPath(file.path);
  if (filePath) {
    try { await fs.promises.unlink(filePath); } catch { /* file may have been deleted already */ }
  }

  await (prisma as any).declarationFile.deleteMany({ where: { fileId: id } }).catch(() => undefined);
  await prisma.uploadedFile.delete({ where: { id } });
  res.json({ message: "File deleted" });
}));

export default router;

