import "dotenv/config";
import { config } from "../config/env";
import { createSmtpTransport } from "../services/emailOutboxWorker";

async function main(): Promise<void> {
  if (!config.emailDelivery.enabled) throw new Error("Set EMAIL_DELIVERY_ENABLED=true before checking SMTP configuration");
  const transport = createSmtpTransport();
  try {
    await transport.verify();
    console.log("[PASS] SMTP connection and authentication verified; no email was sent.");
  } finally {
    transport.close();
  }
}

void main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
    : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
  console.error(`[FAIL] SMTP verification failed (${code || "UnknownError"}); no email was sent.`);
  process.exitCode = 1;
});
