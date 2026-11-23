import { config } from "../config/env";

export interface EmailApiMessage {
  toEmail: string;
  emailSubject: string;
  emailBody: string;
}

export async function sendEmailApi(message: EmailApiMessage): Promise<string | undefined> {
  if (!config.emailDelivery.apiUrl) throw new Error("EMAIL_API is not configured");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Refusing EMAIL_API delivery while TLS verification is disabled");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(config.emailDelivery.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json", ...(config.emailDelivery.apiToken ? { authorization: `Bearer ${config.emailDelivery.apiToken}` } : {}) },
      body: JSON.stringify(message),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`EMAIL_API_HTTP_${response.status}`);
    try { const body = JSON.parse(text) as { messageId?: unknown }; return typeof body.messageId === "string" ? body.messageId : undefined; } catch { return undefined; }
  } finally { clearTimeout(timeout); }
}
