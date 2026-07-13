import { Router, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";

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
    if (ALLOWED_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

// POST /api/files/upload
router.post(
  "/upload",
  authenticate,
  upload.single("file"),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "No file provided" });
      return;
    }

    const declarationId = req.body.declarationId as string | undefined;

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
  }
);

// GET /api/files/:id
router.get("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = path.join(UPLOAD_DIR, file.path);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "File not found on disk" });
    return;
  }

  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.originalName}"`);
  res.sendFile(filePath);
});

// DELETE /api/files/:id
router.delete("/:id", authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params.id as string;
  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  const filePath = path.join(UPLOAD_DIR, file.path);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  await prisma.uploadedFile.delete({ where: { id } });
  res.json({ message: "File deleted" });
});

export default router;
