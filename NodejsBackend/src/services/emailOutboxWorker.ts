import { randomUUID } from "node:crypto";
import nodemailer from "nodemailer";
import { config } from "../config/env";
import { prisma } from "../config/prisma";
import { sendEmailApi } from "./emailApi";

export interface ClaimedEmail {
  id: bigint;
  event: string;
  declarationId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  attemptCount: number;
  maxAttempts: number;
}

export interface EmailDeliveryTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    disableFileAccess: true;
    disableUrlAccess: true;
  }): Promise<{ messageId?: string }>;
  verify?: () => Promise<unknown>;
  close?: () => void;
}

export function createSmtpTransport() {
  if (!config.emailDelivery.enabled) throw new Error("EMAIL_DELIVERY_ENABLED must be true before the email worker can start");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Refusing SMTP delivery while TLS certificate verification is disabled");
  return nodemailer.createTransport({
    host: config.emailDelivery.smtpHost,
    port: config.emailDelivery.smtpPort,
    secure: config.emailDelivery.smtpSecure,
    auth: config.emailDelivery.smtpUser
      ? { user: config.emailDelivery.smtpUser, pass: config.emailDelivery.smtpPass }
      : undefined,
    requireTLS: !config.emailDelivery.smtpSecure,
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
  });
}

export function createEmailApiTransport(): EmailDeliveryTransport {
  return {
    async sendMail(message) {
      const messageId = await sendEmailApi({ toEmail: message.to, emailSubject: message.subject, emailBody: message.text });
      return { messageId };
    },
  };
}

export async function claimEmailBatch(workerId: string, batchSize = config.emailDelivery.batchSize, now = new Date()): Promise<ClaimedEmail[]> {
  const lockedBefore = new Date(now.getTime() - config.emailDelivery.lockTimeoutMs);
  return prisma.$transaction((tx) => tx.$queryRaw<ClaimedEmail[]>`
    WITH candidates AS (
      SELECT "id"
      FROM public."EmailOutbox"
      WHERE (
        ("status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${now}) OR
        ("status" = 'processing' AND "lockedAt" <= ${lockedBefore})
      )
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    UPDATE public."EmailOutbox" AS email
    SET "status" = 'processing',
        "attemptCount" = email."attemptCount" + 1,
        "lockedAt" = ${now},
        "lockedBy" = ${workerId},
        "updatedAt" = ${now}
    FROM candidates
    WHERE email."id" = candidates."id"
    RETURNING email."id", email."event", email."declarationId", email."recipientEmail",
              email."subject", email."body", email."attemptCount", email."maxAttempts"
  `);
}

export async function markEmailSent(email: ClaimedEmail, workerId: string, providerMessageId: string | undefined, now = new Date()): Promise<void> {
  const result = await prisma.emailOutbox.updateMany({
    where: { id: email.id, status: "processing", lockedBy: workerId },
    data: {
      status: "sent",
      sentAt: now,
      providerMessageId: providerMessageId?.slice(0, 998) || null,
      lastErrorCode: null,
      lockedAt: null,
      lockedBy: null,
    },
  });
  if (result.count !== 1) throw new Error("outbox_claim_lost");
}

export async function markEmailFailed(email: ClaimedEmail, workerId: string, errorCode: string, now = new Date()): Promise<void> {
  const terminal = email.attemptCount >= email.maxAttempts;
  const delayMs = Math.min(30_000 * (2 ** Math.max(0, email.attemptCount - 1)), 3_600_000);
  const result = await prisma.emailOutbox.updateMany({
    where: { id: email.id, status: "processing", lockedBy: workerId },
    data: {
      status: terminal ? "failed" : "retry",
      nextAttemptAt: terminal ? now : new Date(now.getTime() + delayMs),
      lastErrorCode: errorCode.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "delivery_failed",
      lockedAt: null,
      lockedBy: null,
    },
  });
  if (result.count !== 1) throw new Error("outbox_claim_lost");
}

function transportErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "delivery_failed";
  const candidate = "code" in error ? error.code : "responseCode" in error ? error.responseCode : "name" in error ? error.name : undefined;
  return typeof candidate === "string" || typeof candidate === "number" ? String(candidate) : "delivery_failed";
}

export async function deliverClaimedEmail(
  email: ClaimedEmail,
  workerId: string,
  transport: EmailDeliveryTransport = config.emailDelivery.apiUrl ? createEmailApiTransport() : createSmtpTransport(),
): Promise<void> {
  try {
    const info = await transport.sendMail({
      from: config.emailDelivery.smtpFrom,
      to: email.recipientEmail,
      subject: email.subject,
      text: email.body,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    await markEmailSent(email, workerId, typeof info.messageId === "string" ? info.messageId : undefined);
    console.info(JSON.stringify({ event: "notification_delivery_succeeded", stage: config.emailDelivery.apiUrl ? "email_api_delivery" : "smtp_delivery", outboxId: String(email.id), notificationType: email.event }));
  } catch (error) {
    const reason = transportErrorCode(error);
    try {
      await markEmailFailed(email, workerId, reason);
      console.error(JSON.stringify({
        event: "notification_delivery_failed",
        stage: config.emailDelivery.apiUrl ? "email_api_delivery" : "smtp_delivery",
        outboxId: String(email.id),
        notificationType: email.event,
        attempt: email.attemptCount,
        terminal: email.attemptCount >= email.maxAttempts,
        reason,
      }));
    } catch (stateError) {
      console.error(JSON.stringify({ event: "notification_outbox_update_failed", outboxId: String(email.id), reason: transportErrorCode(stateError) }));
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runEmailOutboxWorker(): Promise<void> {
  const transport = config.emailDelivery.apiUrl ? createEmailApiTransport() : createSmtpTransport();
  const workerId = randomUUID();

  let stopping = false;
  const stop = () => { stopping = true; };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    if ("verify" in transport && typeof transport.verify === "function") await transport.verify();
    console.info(JSON.stringify({ event: "email_worker_started", workerId, pollIntervalMs: config.emailDelivery.pollIntervalMs, batchSize: config.emailDelivery.batchSize }));
    while (!stopping) {
      const batch = await claimEmailBatch(workerId);
      if (batch.length === 0) {
        await wait(config.emailDelivery.pollIntervalMs);
        continue;
      }
      for (const email of batch) {
        if (stopping) break;
        await deliverClaimedEmail(email, workerId, transport);
      }
    }
  } finally {
    transport.close?.();
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await prisma.$disconnect();
    console.info(JSON.stringify({ event: "email_worker_stopped", workerId }));
  }
}
