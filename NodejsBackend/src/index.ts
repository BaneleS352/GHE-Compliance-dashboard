import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
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
    : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

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

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

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

const shutdown = async () => {
  console.log("Shutting down gracefully...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
