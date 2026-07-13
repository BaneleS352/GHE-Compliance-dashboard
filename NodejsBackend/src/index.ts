import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";
import { config } from "./config/env";
import { swaggerSpec } from "./config/swagger";
import authRoutes from "./routes/auth";
import declarationRoutes from "./routes/declarations";
import workflowRoutes from "./routes/workflows";
import reportRoutes from "./routes/reports";
import fileRoutes from "./routes/files";
import adminDashboardRoutes from "./routes/admin/dashboard";
import adminUserRoutes from "./routes/admin/users";
import adminConfigRoutes from "./routes/admin/config";
import adminWorkflowRoutes from "./routes/admin/workflows";

const app = express();

app.use(cors({ origin: ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"] }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, { explorer: true }));

app.use("/api/auth", authRoutes);
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

app.listen(config.port, () => {
  console.log(`GHE Backend running on http://localhost:${config.port}`);
});

export default app;
