import { prisma } from "../config/prisma";
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

/** Sends through the configured email webhook. With no webhook configured, logs a safe dev-mode message. */
export async function sendNotification(event: NotificationEvent, declarationId: string, recipientId: number | bigint, decision = ""): Promise<void> {
  try {
    const [declaration, recipient, config] = await Promise.all([
      prisma.declaration.findUnique({ where: { id: declarationId }, include: { snapshot: true, declarer: { select: { name: true } } } }),
      prisma.user.findUnique({ where: { id: toDbId(recipientId) }, select: { name: true, email: true } }),
      prisma.systemConfig.findFirst(),
    ]);
    if (!declaration || !recipient?.email) return;
    // Boundary label: notification templates are stored as a JSON text
    // column (free-form operatorconfiguration), so the parse result is
    // validated by shape here instead of a Prisma type.
    let templates: Record<string, { subject?: unknown; body?: unknown }> = {};
    try { templates = JSON.parse(config?.notificationTemplates || "{}"); } catch { return; }
    const template = templates[event];
    if (typeof template?.subject !== "string" || typeof template?.body !== "string") return;
    const data = { declarationId, employee: declaration.snapshot?.declarerName || declaration.declarer?.name || "", recipientName: recipient.name, decision };
    const payload = { to: recipient.email, subject: render(template.subject, data), body: render(template.body, data), event, declarationId };
    const webhook = process.env.EMAIL_WEBHOOK_URL;
    if (!webhook) {
      console.info(JSON.stringify({ event: "notification_skipped", stage: "webhook_delivery", reason: "webhook_not_configured", notificationType: event }));
      return;
    }
    let lastFailure = "delivery_failed";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json", ...(process.env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        if (response.ok) return;
        lastFailure = `http_${response.status}`;
      } catch { lastFailure = "network_error"; }
    }
    console.error(JSON.stringify({ event: "notification_delivery_failed", stage: "webhook_delivery", reason: lastFailure }));
  } catch (error) {
    console.error(JSON.stringify({ event: "notification_failed", stage: "prepare_or_send", errorName: safeErrorName(error) }));
  }
}

function safeErrorName(value: unknown): string {
  if (value && typeof value === "object" && "name" in value && typeof value.name === "string") {
    return value.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "Error";
  }
  return "UnknownError";
}
