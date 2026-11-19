import "dotenv/config";
import { lookup } from "node:dns/promises";
import { createConnection } from "node:net";

const TCP_TIMEOUT_MS = 8_000;

type SmtpStage = "dns" | "tcp" | "smtp";

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "unknown";
  const candidate = "code" in error ? error.code : "name" in error ? error.name : undefined;
  return typeof candidate === "string" ? candidate.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "unknown" : "unknown";
}

async function verifyTcp(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host, port });
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (error) reject(error);
      else resolve();
    };
    socket.setTimeout(TCP_TIMEOUT_MS, () => finish(Object.assign(new Error("SMTP TCP connection timed out"), { code: "ETIMEDOUT" })));
    socket.once("connect", () => finish());
    socket.once("error", (error) => finish(error));
  });
}

function printTroubleshooting(stage: SmtpStage, code: string, host: string, port: number): void {
  if (stage === "dns") {
    console.error("[HINT] Check the SMTP_HOST spelling and whether this machine can resolve external DNS names.");
    return;
  }
  if (stage === "tcp" && (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ENETUNREACH")) {
    console.error(`[HINT] Could not open TCP to ${host}:${port}. Check outbound firewall/network rules and that the SMTP host and port are correct.`);
    console.error("       For Brevo, try 587 with SMTP_SECURE=false, or 465 with SMTP_SECURE=true. Brevo also documents port 2525 for non-implicit-TLS submission.");
    return;
  }
  if (stage === "smtp" && (code === "EAUTH" || code === "535")) {
    console.error("[HINT] Check SMTP_USER against the login shown in Brevo SMTP settings, and use an SMTP key as SMTP_PASS (not an API key or account password).");
  } else if (stage === "smtp" && code === "ETIMEDOUT") {
    console.error("[HINT] TCP connected, but the SMTP server did not complete its greeting or handshake. Check relay availability, port encryption settings, and network inspection/proxy rules.");
  } else if (stage === "smtp" && /CERT|TLS|SSL/i.test(code)) {
    console.error("[HINT] Check the machine's trusted CA certificates and clock. Keep TLS certificate verification enabled.");
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    console.error("[FAIL] NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate checks.");
    console.error("       Remove it from this PowerShell session and from any persistent environment or startup script, then rerun.");
    console.error("       No SMTP connection was attempted and no email was sent.");
    process.exitCode = 1;
    return;
  }

  if (process.env.EMAIL_DELIVERY_ENABLED !== "true") {
    console.error("[FAIL] Set EMAIL_DELIVERY_ENABLED=true in NodejsBackend/.env before checking SMTP.");
    console.error("       No SMTP connection was attempted and no email was sent.");
    process.exitCode = 1;
    return;
  }

  let transport: { verify: () => Promise<unknown>; close: () => void } | undefined;
  let stage: SmtpStage = "dns";
  let host = "";
  let port = 0;
  try {
    const { config } = await import("../config/env");
    const { createSmtpTransport } = await import("../services/emailOutboxWorker");
    if (!config.emailDelivery.enabled) throw new Error("email_delivery_disabled");
    host = config.emailDelivery.smtpHost;
    port = config.emailDelivery.smtpPort;
    console.log(`[INFO] SMTP target: ${host}:${port} (${config.emailDelivery.smtpSecure ? "TLS" : "STARTTLS/upgrade if supported"}); credentials are hidden`);

    const addresses = await lookup(host, { all: true });
    console.log(`[PASS] DNS resolution: ${addresses.length} address(es) returned`);

    stage = "tcp";
    await verifyTcp(host, port);
    console.log("[PASS] TCP connection to SMTP port");

    stage = "smtp";
    transport = createSmtpTransport();
    await transport.verify();
    console.log("[PASS] SMTP connection and authentication verified; no email was sent.");
  } catch (error: unknown) {
    const code = errorCode(error);
    console.error(`[FAIL] ${stage.toUpperCase()} check failed (${code}); no email was sent.`);
    if (host && port) printTroubleshooting(stage, code, host, port);
    process.exitCode = 1;
  } finally {
    transport?.close();
  }
}

void main().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64)
    : error instanceof Error ? error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) : "UnknownError";
  console.error(`[FAIL] SMTP verification could not start (${code || "UnknownError"}); no email was sent.`);
  process.exitCode = 1;
});
