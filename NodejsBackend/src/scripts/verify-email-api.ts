import "dotenv/config";

const apiUrl = process.env.EMAIL_API?.trim() || "";
const apiToken = process.env.EMAIL_API_TOKEN?.trim();
const toEmail = process.env.EMAIL_API_TEST_TO?.trim() || process.argv.find((arg) => arg.startsWith("--to="))?.slice(5).trim() || "";
const shouldSend = process.argv.includes("--send");
const timeoutMs = 10_000;

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!apiUrl) fail("EMAIL_API is not configured.");
  let url: URL;
  try { url = new URL(apiUrl); } catch { fail("EMAIL_API must be a valid HTTP(S) URL."); }
  if (!/^https?:$/.test(url.protocol)) fail("EMAIL_API must use HTTP or HTTPS.");
  if (shouldSend && !toEmail) fail("Set EMAIL_API_TEST_TO or pass --to=recipient@example.com when using --send.");

  const payload = {
    toEmail: toEmail || "test-recipient@example.com",
    emailSubject: "GHE email API connectivity test",
    emailBody: "This is a connectivity test from the GHE Compliance Dashboard.\n\nNo business notification was generated.",
  };
  console.log(`[INFO] EMAIL_API target: ${url.origin}${url.pathname}`);
  console.log(`[INFO] Request contract validated: toEmail, emailSubject, emailBody`);
  if (!shouldSend) {
    console.log("[PASS] Dry run complete; no request was sent. Add --send to send a real test email.");
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}) },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const responseText = await response.text();
    if (!response.ok) fail(`EMAIL_API returned HTTP ${response.status}: ${responseText.slice(0, 300)}`);
    console.log(`[PASS] EMAIL_API accepted the test message (HTTP ${response.status}); recipient=${toEmail}`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") fail(`EMAIL_API timed out after ${timeoutMs}ms.`);
    fail(`EMAIL_API request failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  } finally {
    clearTimeout(timer);
  }
}

void main();
