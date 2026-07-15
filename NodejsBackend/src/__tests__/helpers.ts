import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import authRoutes from "../routes/auth";
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

export function getAdminToken(): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: "user-admin", email: "admin@test.com", role: "admin" }, "test-secret", { expiresIn: "1h" });
}

export function getApproverToken(): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: "user-approver", email: "sipho@test.com", role: "approver" }, "test-secret", { expiresIn: "1h" });
}

export function getTeamToken(): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: "user-team", email: "nomvula@test.com", role: "teamMember" }, "test-secret", { expiresIn: "1h" });
}

export function getHrToken(): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: "user-hr", email: "lindiwe@test.com", role: "approver" }, "test-secret", { expiresIn: "1h" });
}

export function getCeoToken(): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign({ id: "user-ceo", email: "sandile@test.com", role: "approver" }, "test-secret", { expiresIn: "1h" });
}
