import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import authRoutes from "../routes/auth";
import userRoutes from "../routes/users";
import declarationRoutes from "../routes/declarations";
import workflowRoutes from "../routes/workflows";
import reportRoutes from "../routes/reports";
import fileRoutes from "../routes/files";
import adminDashboardRoutes from "../routes/admin/dashboard";
import adminUserRoutes from "../routes/admin/users";
import adminConfigRoutes from "../routes/admin/config";
import adminWorkflowRoutes from "../routes/admin/workflows";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/declarations", declarationRoutes);
  app.use("/api/workflows", workflowRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/files", fileRoutes);
  app.use("/api/admin/dashboard", adminDashboardRoutes);
  app.use("/api/admin/users", adminUserRoutes);
  app.use("/api/admin/config", adminConfigRoutes);
  app.use("/api/admin/workflows", adminWorkflowRoutes);
  app.get("/api/health", (_req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));
  app.use((_req, res) => { res.status(404).json({ error: "Not found" }); });
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Test error handler:", err.message);
    res.status(500).json({ error: err.message || "Internal server error" });
  });
  return app;
}

// Numeric fixture ids shared with globalSetup.ts (1 = admin, 2 = approver,
// 3 = HR, 4 = team member). Tokens are Entra-shaped RS256 JWTs minted with
// the run's throwaway test key; identity resolves from the local user row
// by email, exactly like production. See testAuth.ts.
export {
  getAdminToken,
  getApproverToken,
  getTeamToken,
  getHrToken,
  getKabeloToken,
  getJamesToken,
  testToken,
} from "./testAuth";

/** Resolve the internal numeric key for a public GHE- declaration id. */
export async function pkFor(publicId: string): Promise<bigint> {
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const row = await db.declaration.findUnique({ where: { id: publicId }, select: { declarationPk: true } });
    if (!row) throw new Error(`declaration not found: ${publicId}`);
    return row.declarationPk;
  } finally {
    await db.$disconnect();
  }
}
