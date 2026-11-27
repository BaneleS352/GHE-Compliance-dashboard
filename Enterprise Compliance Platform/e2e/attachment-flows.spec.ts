import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { USERS, AppPage, NewDeclarationPage, uniqueFixture } from "./common-helpers";

interface DeclarationFileResponse {
  id: number;
  name: string;
  size: number;
  type: string;
  url: string;
}

interface DeclarationResponse {
  id: string;
  counterparty: string;
  files: DeclarationFileResponse[];
}

async function tokenHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => sessionStorage.getItem("e2e.auth.token"));
  if (!token) throw new Error("No authenticated E2E token is available");
  return { Authorization: `Bearer ${token}` };
}

async function findDeclaration(page: Page, counterparty: string): Promise<DeclarationResponse> {
  const response = await page.request.get("/api/declarations", { headers: await tokenHeaders(page) });
  expect(response.ok()).toBeTruthy();
  const declarations = await response.json() as DeclarationResponse[];
  const declaration = declarations.find((item) => item.counterparty === counterparty);
  if (!declaration) throw new Error(`Declaration not found for ${counterparty}`);
  return declaration;
}

async function openGiftForm(page: Page, counterparty: string) {
  const app = new AppPage(page);
  const declaration = new NewDeclarationPage(page);
  await app.login(USERS.nomvula.email);
  await app.sidebar("New Declaration");
  await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
  await declaration.completeLowValueGift(counterparty, `Attachment evidence for ${counterparty}`);
  return { app, declaration };
}

async function reopenDraft(page: Page, app: AppPage, declaration: NewDeclarationPage, counterparty: string) {
  await app.sidebar("My Declarations");
  await app.search(counterparty);
  const row = page.getByRole("table").getByRole("row").filter({ hasText: counterparty });
  await expect(row).toContainText("Draft");
  await row.getByRole("button", { name: "Edit", exact: true }).click();
  await declaration.waitForDraftDescription(`Attachment evidence for ${counterparty}`);
}

test.describe("Supporting-document browser flows", () => {
  test("draft evidence persists, downloads, previews, and locks after submission", async ({ page, context }) => {
    const counterparty = uniqueFixture("E2E Attachment Supplies");
    const fileName = "evidence.txt";
    const contents = `GHE supporting evidence for ${counterparty}\n`;
    const { app, declaration } = await openGiftForm(page, counterparty);

    await page.locator('input[type="file"]').setInputFiles({
      name: fileName,
      mimeType: "text/plain",
      buffer: Buffer.from(contents),
    });
    await expect(page.getByText(fileName, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await reopenDraft(page, app, declaration, counterparty);

    const downloadPromise = page.waitForEvent("download");
    await page.getByTitle(`Download ${fileName}`).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(fileName);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    expect(await readFile(downloadPath!, "utf8")).toBe(contents);

    const draft = await findDeclaration(page, counterparty);
    expect(draft.files).toHaveLength(1);
    const fileId = draft.files[0].id;

    await app.login(USERS.sipho.email);
    const siphoHeaders = await tokenHeaders(page);
    const deniedDownload = await page.request.get(`/api/files/${fileId}`, { headers: siphoHeaders });
    expect(deniedDownload.status()).toBe(403);
    const deniedDelete = await page.request.delete(`/api/files/${fileId}`, { headers: siphoHeaders });
    expect(deniedDelete.status()).toBe(403);

    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    await app.search(counterparty);
    const row = page.getByRole("table").getByRole("row").filter({ hasText: counterparty });
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    await declaration.waitForDraftDescription(`Attachment evidence for ${counterparty}`);
    await declaration.submit();
    const declarationId = await declaration.getId();
    expect(declarationId).toMatch(/^GHE-/);
    await page.getByRole("button", { name: "View Declaration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Supporting Documents" })).toBeVisible();

    const popupPromise = context.waitForEvent("page");
    await page.getByRole("button", { name: "View", exact: true }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState("domcontentloaded");
    expect(popup.url()).toMatch(/^blob:/);
    const previewContents = await popup.evaluate(async () => {
      const response = await fetch(location.href);
      return response.text();
    });
    expect(previewContents).toBe(contents);
    await popup.close();

    await expect(page.getByRole("button", { name: `Remove ${fileName}` })).toHaveCount(0);
    const lockedDelete = await page.request.delete(`/api/files/${fileId}`, { headers: await tokenHeaders(page) });
    expect(lockedDelete.status()).toBe(400);
    expect((await lockedDelete.json()).error).toMatch(/locked during review/i);
  });

  test("pending files can be removed and persisted draft evidence can be deleted", async ({ page }) => {
    const counterparty = uniqueFixture("E2E Attachment Delete Supplies");
    const removedFile = "remove-before-save.txt";
    const deletedFile = "delete-after-save.txt";
    await openGiftForm(page, counterparty);
    const input = page.locator('input[type="file"]');

    await input.setInputFiles({ name: removedFile, mimeType: "text/plain", buffer: Buffer.from("remove me") });
    await expect(page.getByText(removedFile, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `Remove ${removedFile}`, exact: true }).click();
    await expect(page.getByText(removedFile, { exact: true })).toHaveCount(0);

    await input.setInputFiles({ name: deletedFile, mimeType: "text/plain", buffer: Buffer.from("delete after save") });
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();

    const draft = await findDeclaration(page, counterparty);
    expect(draft.files.map((file) => file.name)).toEqual([deletedFile]);
    const fileId = draft.files[0].id;
    const deleted = await page.request.delete(`/api/files/${fileId}`, { headers: await tokenHeaders(page) });
    expect(deleted.ok()).toBeTruthy();
    const missing = await page.request.get(`/api/files/${fileId}`, { headers: await tokenHeaders(page) });
    expect(missing.status()).toBe(404);
    expect((await findDeclaration(page, counterparty)).files).toHaveLength(0);
  });

  test("unsupported and oversized files are rejected before upload", async ({ page }) => {
    const counterparty = uniqueFixture("E2E Attachment Validation Supplies");
    await openGiftForm(page, counterparty);
    const input = page.locator('input[type="file"]');

    await input.setInputFiles({
      name: "unsupported.exe",
      mimeType: "application/x-msdownload",
      buffer: Buffer.from("not allowed"),
    });
    await expect(page.getByText("Unsupported file type", { exact: true })).toBeVisible();
    await expect(page.getByText("unsupported.exe is not an allowed file type.", { exact: false })).toBeVisible();

    await input.setInputFiles({
      name: "oversized.txt",
      mimeType: "text/plain",
      buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
    });
    await expect(page.getByText("File is too large", { exact: true })).toBeVisible();
    await expect(page.getByText("oversized.txt exceeds the 10 MB limit.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Remove unsupported.exe|Remove oversized.txt/ })).toHaveCount(0);

    const declarations = await page.request.get("/api/declarations", { headers: await tokenHeaders(page) });
    const items = await declarations.json() as DeclarationResponse[];
    expect(items.some((item) => item.counterparty === counterparty)).toBe(false);
  });

  test("an upload failure keeps the draft without orphaned evidence", async ({ page }) => {
    const counterparty = uniqueFixture("E2E Attachment Failure Supplies");
    await openGiftForm(page, counterparty);
    await page.route("**/api/files/upload", (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "simulated upload failure" }),
    }));
    await page.locator('input[type="file"]').setInputFiles({
      name: "failed-upload.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("must not persist"),
    });
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();

    await expect(page.getByText("Draft saved successfully", { exact: true })).toHaveCount(0);
    await expect(page.getByText("simulated upload failure", { exact: true }).first()).toBeVisible();
    const draft = await findDeclaration(page, counterparty);
    expect(draft.files).toHaveLength(0);
  });
});
