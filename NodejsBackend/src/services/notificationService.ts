import type { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { config } from "../config/env";
import { toDbId } from "./ids";

export type NotificationEvent = "managerApproval" | "hrApproval" | "declarationReturned" | "declarationDeclined" | "declarationApproved";

const PLACEHOLDERS: Record<string, string> = {
  "[Declaration ID]": "declarationId",
  "[Team Member Name]": "employee",
  "[Approving Manager Name]": "recipientName",
  "[HR Approver Name]": "recipientName",
  "[Manager Approval Option]": "decision",
};

function render(value: string, data: Record<string, string>): string {
  return Object.entries(PLACEHOLDERS).reduce((result, [token, key]) => result.replaceAll(token, data[key] || ""), value);
}

export function notificationDedupeKey(event: NotificationEvent, declarationId: string, workflowStepId: bigint | number, recipientId: bigint | number): string {
  const stableInput = `${event}:${declarationId}:${workflowStepId}:${recipientId}`;
  return createHash("sha256").update(stableInput).digest("hex");
}

/** Prepare an event using authoritative profile/template data, then enqueue it through the PostgreSQL procedure. */
export async function queueNotification(
  tx: Prisma.TransactionClient,
  event: NotificationEvent,
  declarationId: string,
  recipientId: number | bigint,
  dedupeKey: string,
  decision = "",
): Promise<boolean> {
  if (!config.emailDelivery.enabled) return false;
  const [declaration, recipient, systemConfig] = await Promise.all([
    tx.declaration.findUnique({ where: { id: declarationId }, include: { snapshot: true, declarer: { select: { name: true } } } }),
    tx.user.findUnique({ where: { id: toDbId(recipientId) }, select: { name: true, email: true } }),
    tx.systemConfig.findFirst(),
  ]);
  if (!declaration || !recipient?.email) return false;

  let templates: Record<string, { subject?: unknown; body?: unknown }>;
  try {
    templates = JSON.parse(systemConfig?.notificationTemplates || "{}");
  } catch {
    throw new Error("notification_templates_invalid");
  }
  const template = templates[event];
  if (typeof template?.subject !== "string" || typeof template.body !== "string") return false;

  const data = {
    declarationId,
    employee: declaration.snapshot?.declarerName || declaration.declarer?.name || "",
    recipientName: recipient.name,
    decision,
  };
  const subject = render(template.subject, data).trim();
  const body = render(template.body, data).trim();

  await tx.$executeRaw`
    CALL public.enqueue_email_notification(
      ${event}, ${declarationId}, ${recipient.email}, ${subject}, ${body}, ${dedupeKey}
    )
  `;
  return true;
}

/** Queue in the caller's transaction without letting a mail/config problem undo a workflow decision. */
export async function queueNotificationSafely(
  tx: Prisma.TransactionClient,
  event: NotificationEvent,
  declarationId: string,
  recipientId: number | bigint,
  dedupeKey: string,
  decision = "",
): Promise<void> {
  if (!config.emailDelivery.enabled) {
    console.info(JSON.stringify({ event: "notification_skipped", stage: "email_outbox", reason: "email_delivery_disabled", notificationType: event }));
    return;
  }
  await tx.$executeRaw`SAVEPOINT notification_enqueue`;
  try {
    const queued = await queueNotification(tx, event, declarationId, recipientId, dedupeKey, decision);
    await tx.$executeRaw`RELEASE SAVEPOINT notification_enqueue`;
    if (queued) console.info(JSON.stringify({ event: "notification_queued", stage: "email_outbox", notificationType: event }));
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT notification_enqueue`;
    await tx.$executeRaw`RELEASE SAVEPOINT notification_enqueue`;
    console.error(JSON.stringify({ event: "notification_enqueue_failed", stage: "email_outbox", notificationType: event, reason: safeErrorCode(error) }));
  }
}

function safeErrorCode(value: unknown): string {
  if (value && typeof value === "object") {
    const candidate = "code" in value ? value.code : "name" in value ? value.name : undefined;
    if (typeof candidate === "string") return candidate.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "Error";
  }
  return "UnknownError";
}
