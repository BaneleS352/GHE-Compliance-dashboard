import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { config, docsEnabled } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import declarationRoutes from "./routes/declarations";
import workflowRoutes from "./routes/workflows";
import reportRoutes from "./routes/reports";
import fileRoutes from "./routes/files";
import adminDashboardRoutes from "./routes/admin/dashboard";
import adminUserRoutes from "./routes/admin/users";
import adminConfigRoutes from "./routes/admin/config";
import adminWorkflowRoutes from "./routes/admin/workflows";
import { prisma } from "./config/prisma";

const app = express();

app.use(helmet());
app.use(morgan("dev"));
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",")
    : process.env.NODE_ENV === "production"
    ? false
    : ["http://localhost:5173", "http://localhost:3000"],
  credentials: false,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Throttling (express-rate-limit v8). Intentionally keyed on the socket IP
// (no `trust proxy`): enabling permissive proxy trust would let clients
// spoof X-Forwarded-For and dodge limits. Behind the Docker nginx proxy all
// traffic shares one peer IP, so raise the budgets via environment instead
// of enabling proxy trust.
function numEnv(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: numEnv("RATE_LIMIT_MAX", 1000), standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, limit: numEnv("RATE_LIMIT_AUTH_MAX", 120), standardHeaders: true, legacyHeaders: false });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, limit: numEnv("RATE_LIMIT_UPLOAD_MAX", 120), standardHeaders: true, legacyHeaders: false });
app.use(globalLimiter);

// Interactive API docs are development-only: never serve them from production.
if (docsEnabled()) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));
}

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/declarations", declarationRoutes);
app.use("/api/workflows", workflowRoutes);
app.use("/api/reports", uploadLimiter, reportRoutes);
app.use("/api/files", uploadLimiter, fileRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);
app.use("/api/admin/users", adminUserRoutes);
app.use("/api/admin/config", adminConfigRoutes);
app.use("/api/admin/workflows", adminWorkflowRoutes);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(config.port, () => {
  console.log(`GHE Backend running on http://localhost:${config.port}`);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const shutdown = () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    prisma.$disconnect().catch(() => {}).finally(() => process.exit(0));
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
