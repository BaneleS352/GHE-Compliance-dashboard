import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { AppPage, USERS } from "./common-helpers";

const EXPORT_PASSWORD = "s3cret-download-pw";
const WRONG_EXPORT_PASSWORD = "wrong-download-pw";
const PROTECT_DOCUMENT_URL = "**/api/reports/protect-document";
const VERIFY_SCRIPT = fileURLToPath(new URL("./verify-protected-export.py", import.meta.url));
const PYTHON = process.env.GHE_PYTHON_BIN || (process.platform === "win32" ? "python" : "python3");
const execFileAsync = promisify(execFile);

const REPORT_DECLARATION_ID = "GHE-2025-0011";
const REPORT_COUNTERPARTY = "Nike SA";
const REPORT_DATE = "2025-06-14";

type ProtectedExportKind = "pdf" | "xlsx";

interface ProtectedExportVerification {
  kind: ProtectedExportKind;
  encrypted: boolean;
  correctPasswordOpened: boolean;
  wrongPasswordRejected: boolean;
  noPasswordRejected: boolean;
  pages?: number;
  worksheets?: number;
  imageCount: number;
  text: string;
}

function verificationFailure(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error) {
    const stderr = String(error.stderr).trim();
    if (stderr) return stderr;
  }
  return error instanceof Error ? error.message : String(error);
}

async function verifyProtectedExport(
  path: string,
  kind: ProtectedExportKind,
  expectedText: string[],
): Promise<ProtectedExportVerification> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync(
      PYTHON,
      [VERIFY_SCRIPT, path, kind, ...expectedText],
      {
        env: {
          ...process.env,
          E2E_EXPORT_PASSWORD: EXPORT_PASSWORD,
          E2E_EXPORT_WRONG_PASSWORD: WRONG_EXPORT_PASSWORD,
          PYTHONUTF8: "1",
        },
        timeout: 60_000,
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
    ));
  } catch (error) {
    throw new Error(`Protected export verification failed: ${verificationFailure(error)}`);
  }

  const summary = JSON.parse(stdout) as ProtectedExportVerification;
  expect(summary.kind).toBe(kind);
  expect(summary.encrypted).toBe(true);
  expect(summary.correctPasswordOpened).toBe(true);
  expect(summary.wrongPasswordRejected).toBe(true);
  expect(summary.noPasswordRejected).toBe(true);
  expect(summary.imageCount).toBeGreaterThanOrEqual(0);
  expect(typeof summary.text).toBe("string");
  if (kind === "pdf") {
    expect(summary.pages).toBeGreaterThan(0);
  } else {
    expect(summary.worksheets).toBeGreaterThan(0);
  }
  return summary;
}

async function fillProtectionPassword(page: Page, dialogTitle: string): Promise<Locator> {
  const dialog = page.getByRole("dialog", { name: dialogTitle, exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Password *", { exact: true }).fill(EXPORT_PASSWORD);
  await dialog.getByLabel("Confirm password *", { exact: true }).fill(EXPORT_PASSWORD);
  return dialog;
}

async function downloadProtectedExport(options: {
  page: Page;
  trigger?: Locator;
  dialogTitle: string;
  kind: ProtectedExportKind;
  filename: RegExp;
  expectedText: string[];
  successMessage: string;
}): Promise<ProtectedExportVerification> {
  const { page, trigger, dialogTitle, kind, filename, expectedText, successMessage } = options;
  if (trigger) await trigger.click();
  const dialog = await fillProtectionPassword(page, dialogTitle);
  const downloadPromise = page.waitForEvent("download", { timeout: 60_000 });
  await dialog.getByRole("button", { name: "Protect & Download", exact: true }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(filename);
  const path = await download.path();
  if (!path) throw new Error(`Playwright did not retain the downloaded ${kind.toUpperCase()} bytes`);
  expect(await download.failure()).toBeNull();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(successMessage, { exact: true })).toBeVisible();

  const summary = await verifyProtectedExport(path, kind, expectedText);
  await test.info().attach(`${download.suggestedFilename()}.verification.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: "application/json",
  });
  return summary;
}

async function openFilteredAdminReport(page: Page): Promise<void> {
  const generateButton = page.getByRole("button", { name: /^(Generate Report|Generating\.\.\.)$/ });
  await expect(generateButton).toHaveText("Generate Report");

  const startResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/reports/high-value"
      && url.searchParams.get("startDate") === REPORT_DATE
      && !url.searchParams.has("endDate");
  });
  await page.getByLabel("Start Date", { exact: true }).fill(REPORT_DATE);
  await startResponse;
  await expect(generateButton).toHaveText("Generate Report");

  const filteredResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === "/api/reports/high-value"
      && url.searchParams.get("startDate") === REPORT_DATE
      && url.searchParams.get("endDate") === REPORT_DATE;
  });
  await page.getByLabel("End Date", { exact: true }).fill(REPORT_DATE);
  await filteredResponse;
  await expect(generateButton).toHaveText("Generate Report");

  const reportRow = page.getByRole("row").filter({ hasText: USERS.nomvula.name });
  await expect(reportRow).toBeVisible();
  await expect(reportRow).toContainText(REPORT_COUNTERPARTY);
  await expect(reportRow.getByRole("cell").nth(2)).toHaveText("1");
  await expect(reportRow.getByRole("cell").nth(3)).toHaveText("R 1 500");
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.clear(); } catch { /* storage may be unavailable */ }
  });
});

test.describe("Protected exports — desktop", () => {
  test.skip(({ isMobile }) => isMobile, "Runs in the desktop Playwright project");

  test("Admin Reports Excel contains the filtered report and rejects wrong or missing passwords", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Reports");
    await expect(page.getByRole("heading", { name: "Operational Management Reports", exact: true })).toBeVisible();
    await openFilteredAdminReport(page);

    await downloadProtectedExport({
      page,
      trigger: page.getByRole("button", { name: "Export Excel", exact: true }),
      dialogTitle: "Protect export",
      kind: "xlsx",
      filename: /^protected-High-Value_Gifts_Report_\d{4}-\d{2}-\d{2}\.xlsx$/,
      expectedText: [
        "High-Value Gifts Report",
        "Employee",
        "Most Frequent Supplier",
        USERS.nomvula.name,
        USERS.sipho.name,
        REPORT_COUNTERPARTY,
        "1500",
      ],
      successMessage: "Protected export downloaded.",
    });
  });

  test("Admin Reports PDF uses the image renderer and the downloaded image PDF is protected", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Reports");
    await openFilteredAdminReport(page);

    await page.getByRole("button", { name: "Export PDF", exact: true }).click();
    await expect(page.getByText("Report PDF rendered.", { exact: true })).toBeVisible();
    await expect(page.getByText("Image render failed — using the text-layout fallback for protection.", { exact: true })).toHaveCount(0);

    const summary = await downloadProtectedExport({
      page,
      dialogTitle: "Protect export",
      kind: "pdf",
      filename: /^protected-High-Value_Gifts_Report_\d{4}-\d{2}-\d{2}\.pdf$/,
      expectedText: [],
      successMessage: "Protected export downloaded.",
    });
    expect(summary.imageCount).toBeGreaterThan(0);
  });

  test("Admin Reports PDF falls back to protected text layout when canvas.toDataURL throws", async ({ page }) => {
    await page.addInitScript(() => {
      HTMLCanvasElement.prototype.toDataURL = () => {
        throw new Error("Forced canvas.toDataURL failure for export fallback coverage");
      };
    });
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Reports");
    await openFilteredAdminReport(page);

    await page.getByRole("button", { name: "Export PDF", exact: true }).click();
    await expect(page.getByText("Image render failed — using the text-layout fallback for protection.", { exact: true })).toBeVisible();
    await expect(page.getByText("Report PDF rendered.", { exact: true })).toHaveCount(0);

    const summary = await downloadProtectedExport({
      page,
      dialogTitle: "Protect export",
      kind: "pdf",
      filename: /^protected-High-Value_Gifts_Report_\d{4}-\d{2}-\d{2}\.pdf$/,
      expectedText: ["High-Value Gifts Report", USERS.nomvula.name, USERS.sipho.name, REPORT_COUNTERPARTY],
      successMessage: "Protected export downloaded.",
    });
    expect(summary.imageCount).toBe(0);
  });

  test("protection failures are visible and never download the unprotected report", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Reports");
    await openFilteredAdminReport(page);

    const failures = [
      {
        status: 503,
        responseError: "Injected protection outage",
        visibleError: "Password protection is unavailable on this server. No file was downloaded.",
      },
      {
        status: 502,
        responseError: "Injected document encryption failure",
        visibleError: "Injected document encryption failure",
      },
    ];

    for (const failure of failures) {
      let protectionAttempts = 0;
      await page.route(PROTECT_DOCUMENT_URL, async (route) => {
        protectionAttempts += 1;
        await route.fulfill({
          status: failure.status,
          contentType: "application/json",
          body: JSON.stringify({ error: failure.responseError }),
        });
      });
      try {
        await page.getByRole("button", { name: "Export Excel", exact: true }).click();
        const dialog = await fillProtectionPassword(page, "Protect export");
        const unexpectedDownload = page.waitForEvent("download", { timeout: 1_500 }).then(
          () => true,
          () => false,
        );
        await dialog.getByRole("button", { name: "Protect & Download", exact: true }).click();

        await expect(page.getByText(failure.visibleError, { exact: true })).toBeVisible();
        await expect(dialog).toHaveCount(0);
        expect(protectionAttempts).toBe(1);
        expect(await unexpectedDownload).toBe(false);
        await expect(page.getByText("Protected export downloaded.", { exact: true })).toHaveCount(0);
      } finally {
        await page.unroute(PROTECT_DOCUMENT_URL);
      }
    }
  });

  test("Approval Queue Excel contains the filtered actionable declaration and is protected", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.search(REPORT_DECLARATION_ID);
    const queueRow = page.getByRole("row").filter({ hasText: REPORT_DECLARATION_ID });
    await expect(queueRow).toBeVisible();
    await expect(queueRow).toContainText(REPORT_COUNTERPARTY);

    const summary = await downloadProtectedExport({
      page,
      trigger: page.getByRole("button", { name: "Export Excel", exact: true }),
      dialogTitle: "Protect Excel export",
      kind: "xlsx",
      filename: /^protected-ApprovalQueue_\d{4}-\d{2}-\d{2}\.xlsx$/,
      expectedText: [
        "ID",
        "Employee",
        "Counterparty",
        REPORT_DECLARATION_ID,
        USERS.nomvula.name,
        "Marketing",
        "Gift",
        REPORT_COUNTERPARTY,
        "Pending",
        "Line Manager Review",
      ],
      successMessage: "Protected Excel export downloaded.",
    });
    expect(summary.text).not.toContain("GHE-2024-0044");
  });

  test("My Declarations full-list Excel includes every owned declaration and is protected", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    const subtitle = page.getByText(/\d+ of your Declarations/);
    await expect(subtitle).toBeVisible();
    const expectedCount = Number((await subtitle.textContent())?.match(/^\d+/)?.[0]);
    expect(expectedCount).toBeGreaterThan(0);

    const summary = await downloadProtectedExport({
      page,
      trigger: page.getByRole("button", { name: "Export Excel", exact: true }),
      dialogTitle: "Protect Excel export",
      kind: "xlsx",
      filename: /^protected-Declarations_\d{4}-\d{2}-\d{2}\.xlsx$/,
      expectedText: [
        "ID",
        "Employee",
        "Approver",
        "GHE-2024-0047",
        "GHE-2025-0011",
        "GHE-2025-0009",
        USERS.nomvula.name,
        "Nike SA",
        "Southern Sun",
      ],
      successMessage: "Protected Excel export downloaded.",
    });

    const exportedIds = summary.text.match(/\bGHE-\d{4}-(?:\d{5,6}|[0-9a-f]{8})\b/g) ?? [];
    expect(exportedIds).toHaveLength(expectedCount);
    expect(new Set(exportedIds).size).toBe(expectedCount);
  });

  test("My Declarations single-row Excel contains only the selected declaration and is protected", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    await app.search(REPORT_DECLARATION_ID);
    const declarationRow = page.getByRole("row").filter({ hasText: REPORT_DECLARATION_ID });
    await expect(declarationRow).toBeVisible();

    const summary = await downloadProtectedExport({
      page,
      trigger: declarationRow.getByRole("button", { name: "Export", exact: true }),
      dialogTitle: "Protect Excel export",
      kind: "xlsx",
      filename: /^protected-GHE-2025-0011\.xlsx$/,
      expectedText: [
        "ID",
        "Employee",
        "Department",
        "Priority",
        REPORT_DECLARATION_ID,
        USERS.nomvula.name,
        "Marketing",
        "Gift",
        REPORT_COUNTERPARTY,
        "1500",
        "Pending",
        "Lindiwe Zulu",
        "High",
      ],
      successMessage: "Protected Excel export downloaded.",
    });
    expect(summary.text).not.toContain("GHE-2024-0047");
    expect(summary.text).not.toContain("GHE-2025-0009");
  });

  test("an empty filtered My Declarations Excel export is still password-protected", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    await page.getByPlaceholder("ID, Counterparty, Employee or Approver", { exact: true }).fill("NO-SUCH-GHE-999999");
    await expect(page.getByRole("table").getByText("No declarations found", { exact: true })).toBeVisible();

    const summary = await downloadProtectedExport({
      page,
      trigger: page.getByRole("button", { name: "Export Excel", exact: true }),
      dialogTitle: "Protect Excel export",
      kind: "xlsx",
      filename: /^protected-Declarations_\d{4}-\d{2}-\d{2}\.xlsx$/,
      expectedText: [],
      successMessage: "Protected Excel export downloaded.",
    });
    expect(summary.worksheets).toBe(1);
  });
});
