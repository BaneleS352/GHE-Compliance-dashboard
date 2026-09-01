import { Router, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

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

function handleMulterError(err: Error, _req: AuthRequest, res: Response, next: NextFunction): void {
  if (err instanceof MulterError) {
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
        try { await fs.promises.unlink(path.join(UPLOAD_DIR, req.file.filename)); } catch {}
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

    const file = await prisma.uploadedFile.create({
      data: {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.filename,
        declarationId: declarationId || null,
      },
    });

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
        const inst = await prisma.workflowInstance.findUnique({ where: { declarationId: decl.id } });
        if (inst) {
          try {
            const steps: any[] = JSON.parse(inst.steps as string);
            isApprover = steps.some((s: any) => s.assignee === req.user!.id);
          } catch { isApprover = false; }
        }
      }
      if (!isApprover) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
  }

  const filePath = path.join(UPLOAD_DIR, file.path);
  if (!fs.existsSync(filePath)) {
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
        const inst = await prisma.workflowInstance.findUnique({ where: { declarationId: decl.id } });
        if (inst) {
          try {
            const steps: any[] = JSON.parse(inst.steps as string);
            isApprover = steps.some((s: any) => s.assignee === req.user!.id);
          } catch { isApprover = false; }
        }
      }
      if (!isApprover) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
  }

  const filePath = path.join(UPLOAD_DIR, file.path);
  try { await fs.promises.unlink(filePath); } catch { /* file may have been deleted already */ }

  await prisma.uploadedFile.delete({ where: { id } });
  res.json({ message: "File deleted" });
}));

export default router;

