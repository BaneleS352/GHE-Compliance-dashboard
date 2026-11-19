import { Router, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import { prisma } from "../config/prisma";
import { authenticate, AuthRequest } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { readWorkflowStepRows, getDeclarationPk, lockDeclarationRow } from "../services/normalization";
import { parseIdParam, toDbId, toJsonId } from "../services/ids";
import { recordDeclarationAudit } from "../services/declarationAudit";
import { isCrossDepartmentLineManager, isOutsideOrganizationScope } from "../services/declarationAccess";
import { enqueueAttachmentCleanup, enqueueAttachmentCleanupAfterFailure } from "../services/attachmentCleanupQueue";
import {
  deleteStoredAttachment,
  isAzuriteAttachment,
  readStoredAttachment,
  storeUploadedAttachment,
} from "../services/attachmentStorage";

const router = Router();

const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "text/plain",
];
const ALLOWED_EXTS = new Set([".pdf", ".xlsx", ".docx", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".txt"]);

const upload = multer({
  storage: multer.memoryStorage(),
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

/** Step-row assignee check (rows are the only workflow state). */
async function isWorkflowAssignee(declarationPk: bigint, userPkJson: number): Promise<boolean> {
  const steps = await readWorkflowStepRows(declarationPk);
  if (!steps) return false;
  return steps.some((step) => step.assignee === userPkJson);
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
    let storageReference: string | null = null;

    const cleanupFile = async () => {
      if (storageReference) {
        try { await deleteStoredAttachment(storageReference); } catch {
          await enqueueAttachmentCleanupAfterFailure(storageReference, "upload_rollback");
        }
      }
    };

    if (!declarationId) {
      await cleanupFile();
      res.status(400).json({ error: "declarationId is required" });
      return;
    }

    const pk = await getDeclarationPk(String(declarationId));
    if (!pk) {
      await cleanupFile();
      res.status(400).json({ error: "Declaration not found" });
      return;
    }
    const decl = await prisma.declaration.findUnique({ where: { declarationPk: pk }, include: { snapshot: true } });
    if (!decl) {
      await cleanupFile();
      res.status(400).json({ error: "Declaration not found" });
      return;
    }
    if (req.user!.role !== "admin" && decl.declarerUserId !== toDbId(req.user!.id)) {
      await cleanupFile();
      res.status(403).json({ error: "Cannot upload to another user's declaration" });
      return;
    }
    if (isOutsideOrganizationScope(req.user!, decl.organizationId)) {
      await cleanupFile();
      res.status(403).json({ error: "Cannot upload to a declaration from another organization" });
      return;
    }
    if (isCrossDepartmentLineManager(req.user!, decl.snapshot?.department)) {
      await cleanupFile();
      res.status(403).json({ error: "Access denied: declaration is outside your department" });
      return;
    }
    // Evidence is immutable after decision — same rule as PUT (Draft/Returned only).
    if (decl.status !== "Draft" && decl.status !== "Returned") {
      await cleanupFile();
      res.status(400).json({ error: "Cannot upload files to a declaration that is not a draft or returned" });
      return;
    }

    // Single transaction: file metadata + the DeclarationFile join row commit
    // atomically. Orphan UploadedFile rows are rejected — a file without a
    // join row is never created.
    storageReference = await storeUploadedAttachment(req.file);
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        if (!await lockDeclarationRow(tx, pk)) return { kind: "not_found" as const };
        const currentDeclaration = await tx.declaration.findUnique({ where: { declarationPk: pk }, include: { snapshot: true } });
        if (!currentDeclaration) return { kind: "not_found" as const };
        if (req.user!.role !== "admin" && currentDeclaration.declarerUserId !== toDbId(req.user!.id)) {
          return { kind: "forbidden" as const };
        }
        if (isOutsideOrganizationScope(req.user!, currentDeclaration.organizationId)) {
          return { kind: "wrong_organization" as const };
        }
        if (isCrossDepartmentLineManager(req.user!, currentDeclaration.snapshot?.department)) {
          return { kind: "wrong_department" as const };
        }
        if (currentDeclaration.status !== "Draft" && currentDeclaration.status !== "Returned") {
          return { kind: "locked" as const };
        }
        const created = await tx.uploadedFile.create({
          data: {
            originalName: req.file!.originalname,
            mimeType: req.file!.mimetype,
            size: req.file!.size,
            storageReference: storageReference!,
          },
        });
        await tx.declarationFile.create({
          data: { declarationPk: pk, fileId: created.id },
        });
        await recordDeclarationAudit(tx, {
          declarationPk: pk,
          declarationId: currentDeclaration.id,
          organizationId: currentDeclaration.organizationId,
          actorUserId: req.user!.id,
          actorName: req.user!.name,
          action: "file_uploaded",
          changedFields: ["files"],
          newValues: { id: created.id, name: created.originalName, mimeType: created.mimeType, size: created.size },
        });
        return { kind: "created" as const, file: created };
      });
    } catch (error) {
      await cleanupFile();
      throw error;
    }

    if (result.kind !== "created") {
      await cleanupFile();
      if (result.kind === "forbidden") {
        res.status(403).json({ error: "Cannot upload to another user's declaration" });
      } else if (result.kind === "wrong_organization") {
        res.status(403).json({ error: "Cannot upload to a declaration from another organization" });
      } else if (result.kind === "wrong_department") {
        res.status(403).json({ error: "Access denied: declaration is outside your department" });
      } else if (result.kind === "locked") {
        res.status(400).json({ error: "Cannot upload files to a declaration that is not a draft or returned" });
      } else {
        res.status(404).json({ error: "Declaration not found" });
      }
      return;
    }
    const file = result.file;

    res.status(201).json({
      id: toJsonId(file.id),
      name: file.originalName,
      size: file.size,
      type: file.mimeType,
      url: `/api/files/${toJsonId(file.id)}`,
      uploadedAt: file.uploadedAt,
    });
  })
);

// GET /api/files/:id
router.get("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const filePk = parseIdParam(req.params.id);
  if (filePk === null) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  const file = await prisma.uploadedFile.findUnique({
    where: { id: filePk },
    include: { link: { include: { declaration: { include: { snapshot: true } } } } },
  });
  if (!file) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  // Ownership scoping — require admin or owner/assignee via the join row.
  // Files without a join row are orphaned and only admins can access them.
  const userPkJson = toJsonId(req.user!.id);
  if (req.user!.role !== "admin") {
    const declaration = file.link?.declaration;
    if (!declaration) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (isOutsideOrganizationScope(req.user!, declaration.organizationId) ||
      isCrossDepartmentLineManager(req.user!, declaration.snapshot?.department)) {
      res.status(403).json({ error: "Access denied" });
      return;
    }
    if (declaration.declarerUserId !== toDbId(req.user!.id)) {
      const isApprover = await isWorkflowAssignee(declaration.declarationPk, userPkJson);
      if (!isApprover) {
        res.status(403).json({ error: "Access denied" });
        return;
      }
    }
  }

  if (!isAzuriteAttachment(file.storageReference)) {
    res.status(404).json({ error: "File not found in Azurite; existing local uploads must be migrated" });
    return;
  }

  const contents = await readStoredAttachment(file.storageReference);
  if (!contents) {
    res.status(404).json({ error: "File not found" });
    return;
  }

  res.setHeader("Content-Type", file.mimeType);
  // Sanitize filename for Content-Disposition (prevent header injection)
  const safeName = file.originalName.replace(/["\r\n]/g, "_");
  const encoded = encodeURIComponent(safeName);
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"; filename*=UTF-8''${encoded}`);
  res.send(contents);
}));

// DELETE /api/files/:id
router.delete("/:id", authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const filePk = parseIdParam(req.params.id);
  if (filePk === null) {
    res.status(404).json({ error: "File not found" });
    return;
  }
  // Delete policy and current file ownership/status are resolved in one
  // transaction so reviewers cannot erase evidence and submit cannot race it.
  const deletion = await prisma.$transaction(async (tx) => {
    const currentFile = await tx.uploadedFile.findUnique({
      where: { id: filePk },
      include: { link: { include: { declaration: { include: { snapshot: true } } } } },
    });
    if (!currentFile) return { kind: "not_found" as const };

    let currentDeclaration = currentFile.link?.declaration ?? null;
    if (currentDeclaration) {
      if (!await lockDeclarationRow(tx, currentDeclaration.declarationPk)) return { kind: "not_found" as const };
      currentDeclaration = await tx.declaration.findUnique({ where: { declarationPk: currentDeclaration.declarationPk }, include: { snapshot: true } });
      if (!currentDeclaration) return { kind: "not_found" as const };
      if (isOutsideOrganizationScope(req.user!, currentDeclaration.organizationId)) return { kind: "wrong_organization" as const };
      if (isCrossDepartmentLineManager(req.user!, currentDeclaration.snapshot?.department)) return { kind: "wrong_department" as const };
    } else if (req.user!.role !== "admin") {
      return { kind: "forbidden" as const };
    }

    if (req.user!.role !== "admin" && currentDeclaration?.declarerUserId !== toDbId(req.user!.id)) {
      return { kind: "forbidden" as const };
    }
    if (currentDeclaration && currentDeclaration.status !== "Draft" && currentDeclaration.status !== "Returned") {
      return { kind: "locked" as const };
    }
    if (!isAzuriteAttachment(currentFile.storageReference)) return { kind: "migration" as const };

    if (currentDeclaration) {
      await recordDeclarationAudit(tx, {
        declarationPk: currentDeclaration.declarationPk,
        declarationId: currentDeclaration.id,
        organizationId: currentDeclaration.organizationId,
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        action: "file_deleted",
        changedFields: ["files"],
        oldValues: { id: currentFile.id, name: currentFile.originalName, mimeType: currentFile.mimeType, size: currentFile.size },
      });
    }
    await enqueueAttachmentCleanup(tx, currentFile.storageReference);
    await tx.declarationFile.deleteMany({ where: { fileId: filePk } });
    await tx.uploadedFile.delete({ where: { id: filePk } });
    return { kind: "deleted" as const };
  });

  if (deletion.kind !== "deleted") {
    if (deletion.kind === "forbidden") res.status(403).json({ error: "Only the owner or admin can delete files" });
    else if (deletion.kind === "wrong_organization") res.status(403).json({ error: "Cannot access files from another organization" });
    else if (deletion.kind === "wrong_department") res.status(403).json({ error: "Access denied: declaration is outside your department" });
    else if (deletion.kind === "locked") res.status(400).json({ error: "Evidence is locked during review; files can be deleted only while a declaration is draft or returned" });
    else if (deletion.kind === "migration") res.status(503).json({ error: "Attachment storage migration required; ask an administrator to migrate existing uploads to Azurite" });
    else res.status(404).json({ error: "File not found" });
    return;
  }
  res.json({ message: "File deleted" });
}));

export default router;
