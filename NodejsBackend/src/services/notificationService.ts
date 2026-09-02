import { prisma } from "../config/prisma";

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
export async function sendNotification(event: NotificationEvent, declarationId: string, recipientId: string, decision = ""): Promise<void> {
  try {
    const [declaration, recipient, config] = await Promise.all([
      prisma.declaration.findUnique({ where: { id: declarationId } }),
      prisma.user.findUnique({ where: { id: recipientId }, select: { name: true, email: true } }),
      prisma.systemConfig.findFirst(),
    ]);
    if (!declaration || !recipient?.email) return;
    let templates: any = {};
    try { templates = JSON.parse(config?.notificationTemplates || "{}"); } catch { return; }
    const template = templates[event];
    if (!template?.subject || !template?.body) return;
    const data = { declarationId, employee: declaration.employee, recipientName: recipient.name, decision };
    const payload = { to: recipient.email, subject: render(template.subject, data), body: render(template.body, data), event, declarationId };
    const webhook = process.env.EMAIL_WEBHOOK_URL;
    if (!webhook) {
      console.info(`[email:dev] ${event} -> ${recipient.email} (${declarationId})`);
      return;
    }
    let lastError = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json", ...(process.env.EMAIL_WEBHOOK_TOKEN ? { authorization: `Bearer ${process.env.EMAIL_WEBHOOK_TOKEN}` } : {}) }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
        if (response.ok) return;
        lastError = `HTTP ${response.status}`;
      } catch (error: any) { lastError = error?.message || "Delivery failed"; }
    }
    console.error(`[email] delivery failed for ${declarationId}: ${lastError}`);
  } catch (error) {
    console.error(`[email] notification failed for ${declarationId}`, error);
  }
}
