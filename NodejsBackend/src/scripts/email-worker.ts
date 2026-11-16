import "dotenv/config";
import { runEmailOutboxWorker } from "../services/emailOutboxWorker";

void runEmailOutboxWorker().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
    : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
  console.error(JSON.stringify({ event: "email_worker_start_failed", reason: code || "UnknownError" }));
  process.exitCode = 1;
});
