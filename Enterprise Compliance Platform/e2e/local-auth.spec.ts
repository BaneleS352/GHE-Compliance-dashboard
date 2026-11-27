import { test, expect, type Page } from "@playwright/test";

test.describe.configure({ retries: 0 });

const EMAIL_CAPTURE_URL = process.env.E2E_EMAIL_CAPTURE_URL || "http://127.0.0.1:55444";
const SEED_PASSWORD = "LocalDevPassword!2026";
const ENROLLED_PASSWORD = "E2E-Enrolled-Password-2026";
const RESET_PASSWORD = "E2E-Reset-Password-2026";

interface CapturedEmail {
  toEmail: string;
  emailSubject: string;
  emailBody: string;
  receivedAt: string;
}

async function clearMessages() {
  const response = await fetch(`${EMAIL_CAPTURE_URL}/messages`, { method: "DELETE" });
  expect(response.ok).toBeTruthy();
}

async function latestCode(subject: string): Promise<string> {
  let code = "";
  await expect.poll(async () => {
    const response = await fetch(`${EMAIL_CAPTURE_URL}/messages`);
    expect(response.ok).toBeTruthy();
    const messages = await response.json() as CapturedEmail[];
    const message = [...messages].reverse().find((item) => item.emailSubject.includes(subject));
    code = message?.emailBody.match(/code is (\d{6})/)?.[1] ?? "";
    return code;
  }, { timeout: 15000 }).not.toBe("");
  return code;
}

async function openEmployeeSignIn(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Or sign in with your employee ID/ }).click();
  await page.getByLabel("Employee ID", { exact: true }).fill("1");
  await page.getByLabel("Password", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back!" })).toBeVisible();
  const tokens = await page.evaluate(() => ({
    local: sessionStorage.getItem("ghe.local.auth.token"),
    injected: sessionStorage.getItem("e2e.auth.token"),
  }));
  expect(tokens).toEqual({ local: null, injected: null });
}

test("employee-ID OTP enrollment, recovery, and sign-out", async ({ page }) => {
  await clearMessages();
  await openEmployeeSignIn(page);
  const signInCode = await latestCode("employee sign-in verification code");

  const wrongCode = signInCode === "000000" ? "111111" : "000000";
  await page.getByLabel("Verification code", { exact: true }).fill(wrongCode);
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Invalid or expired verification code");

  await page.getByLabel("Verification code", { exact: true }).fill(signInCode);
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Set password and sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Password must be between 12 and 128 characters");

  await page.getByLabel("New password", { exact: true }).fill(ENROLLED_PASSWORD);
  await page.getByRole("button", { name: "Set password and sign in", exact: true }).click();
  await expect(page.locator("aside nav:visible")).toBeVisible();
  await expect(page.getByRole("banner").getByText("Nomvula Dlamini", { exact: true })).toBeVisible();
  await signOut(page);

  await page.getByRole("button", { name: /Or sign in with your employee ID/ }).click();
  await page.getByRole("button", { name: "Forgot password?", exact: true }).click();
  await page.getByLabel("Recovery employee ID", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Send code", exact: true }).click();
  await expect(page.getByLabel("Recovery code", { exact: true })).toBeVisible();
  const resetCode = await latestCode("password reset verification code");

  await page.getByLabel("Recovery code", { exact: true }).fill(resetCode);
  await page.getByLabel("Reset password", { exact: true }).fill(RESET_PASSWORD);
  await page.getByLabel("Confirm new password", { exact: true }).fill("different-password");
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("The passwords do not match.");

  await page.getByLabel("Confirm new password", { exact: true }).fill(RESET_PASSWORD);
  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  let confirmation = page.getByRole("dialog", { name: "Reset your password?", exact: true });
  await expect(confirmation).toContainText("Your previous password will stop working.");
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirmation).toHaveCount(0);

  await page.getByRole("button", { name: "Reset password", exact: true }).click();
  confirmation = page.getByRole("dialog", { name: "Reset your password?", exact: true });
  await confirmation.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(page.locator("aside nav:visible")).toBeVisible();
  await signOut(page);

  await page.getByRole("button", { name: /Or sign in with your employee ID/ }).click();
  await page.getByLabel("Employee ID", { exact: true }).fill("1");
  await page.getByLabel("Password", { exact: true }).fill(RESET_PASSWORD);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByLabel("Verification code", { exact: true })).toBeVisible();
  const finalCode = await latestCode("employee sign-in verification code");
  await page.getByLabel("Verification code", { exact: true }).fill(finalCode);
  await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await expect(page.locator("aside nav:visible")).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await signOut(page);
});
