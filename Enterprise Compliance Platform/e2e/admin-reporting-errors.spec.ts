import { test, expect, type Page } from "@playwright/test";
import { AppPage, NewDeclarationPage, USERS, login, uniqueFixture } from "./common-helpers";
import type { SystemConfig, WorkflowRule } from "../src/types/declaration";

interface ApiResult<T> {
  status: number;
  body: T;
}

interface ApiInit {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
}

interface Organization {
  id: number;
  name: string;
  shortCode: string;
}

interface ApprovalOption {
  id: string;
  value: string;
  label: string;
}

interface QueueResponse {
  total: number;
}

interface WorkflowInstanceResponse {
  steps: Array<{ role: string }>;
}

interface CounterpartyReportRow {
  counterparty: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

interface HighValueReportRow {
  employee: string;
  declarationCount: number;
  totalValue: number;
  averageValue: number;
  totalGift: number;
  totalHospitality: number;
  totalEntertainment: number;
  mostFrequentSupplier: string;
}

async function apiRequest<T>(page: Page, path: string, init: ApiInit = {}, providedToken?: string): Promise<ApiResult<T>> {
  return page.evaluate(async ({ requestPath, requestInit, token }) => {
    const bearer = token ?? sessionStorage.getItem("e2e.auth.token");
    if (!bearer) throw new Error("No E2E bearer token is available");
    const response = await fetch(requestPath, {
      method: requestInit.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearer}`,
      },
      ...(requestInit.body === undefined ? {} : { body: JSON.stringify(requestInit.body) }),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = text;
      }
    }
    return { status: response.status, body: body as T };
  }, { requestPath: path, requestInit: init, token: providedToken });
}

async function apiGet<T>(page: Page, path: string, token?: string): Promise<T> {
  const result = await apiRequest<T>(page, path, {}, token);
  expect(result.status, `${path} returned ${result.status}: ${JSON.stringify(result.body)}`).toBe(200);
  return result.body;
}

async function sessionToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => sessionStorage.getItem("e2e.auth.token"));
  if (!token) throw new Error("No E2E bearer token is available");
  return token;
}

async function deleteFixtureIfPresent(page: Page, path: string, token: string): Promise<void> {
  const result = await apiRequest<{ error?: string }>(page, path, { method: "DELETE" }, token);
  expect([200, 404], `${path} cleanup returned ${result.status}: ${JSON.stringify(result.body)}`).toContain(result.status);
}

async function createGiftDeclaration(page: Page, counterparty: string, value: number, date = "2026-07-15"): Promise<string> {
  const app = new AppPage(page);
  const declaration = new NewDeclarationPage(page);
  await app.login(USERS.nomvula.email);
  await app.sidebar("New Declaration");
  await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
  await declaration.completeLowValueGift(counterparty, `Automated declaration for ${counterparty}`);
  await declaration.date(date);
  await declaration.number("Rand Value or Equivalent", String(value));
  await declaration.substantiation(`Supporting business rationale for ${counterparty}`);
  await declaration.submit();
  const id = await declaration.getId();
  expect(id).toMatch(/^GHE-/);
  await declaration.closeModal();
  return id;
}

function formatRand(value: number): string {
  return `R ${value.toLocaleString("en-ZA")}`;
}

function reportPath(endpoint: string, status: string): string {
  const params = new URLSearchParams({
    startDate: "2026-07-15",
    endDate: "2026-07-15",
    department: "Marketing",
    status,
  });
  return `${endpoint}?${params.toString()}`;
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.clear(); } catch { /* storage may be unavailable */ }
  });
});

test.describe("Phase 2 desktop journey breadth", () => {
  test.skip(({ isMobile }) => isMobile, "Runs in the desktop Playwright project");

  test("configuration validates thresholds, routes a new declaration through HR, and restores the original values", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Config");

    const original = await apiGet<SystemConfig>(page, "/api/admin/config");
    const adminToken = await sessionToken(page);
    let configPuts = 0;
    page.on("request", (request) => {
      if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/config") configPuts += 1;
    });

    try {
      const highValue = page.getByLabel("High Value Declaration Threshold (ZAR)", { exact: true });
      const mediumValue = page.getByLabel("Medium Priority Threshold (ZAR)", { exact: true });
      const save = page.getByRole("button", { name: "Save Changes", exact: true });

      await highValue.fill("500");
      await mediumValue.fill("600");
      await save.click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "Medium priority threshold must not exceed the high-value threshold." })).toHaveText("Medium priority threshold must not exceed the high-value threshold.");
      expect(configPuts).toBe(0);

      await mediumValue.fill("100");
      await save.click();
      await expect(page.locator("main").getByRole("status").filter({ hasText: "Configuration saved successfully." })).toHaveText("Configuration saved successfully.");
      expect(configPuts).toBe(1);

      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(highValue).toHaveValue("500");
      await expect(mediumValue).toHaveValue("100");

      const counterparty = uniqueFixture("E2E Threshold Supplies");
      const declarationId = await createGiftDeclaration(page, counterparty, 750);
      const workflow = await apiGet<WorkflowInstanceResponse>(page, `/api/workflows/instances/${declarationId}`);
      expect(workflow.steps.map((step) => step.role)).toEqual(["lineManager", "hr"]);

      await app.login(USERS.sipho.email);
      await app.sidebar("Approval Queue");
      await app.clickReviewFor(declarationId);
      await app.pickDecision("Accept");
      await app.submitDecision();

      await app.login(USERS.lindiwe.email);
      await app.sidebar("Approval Queue");
      await app.search(declarationId);
      await expect(page.getByRole("table").getByRole("row").filter({ hasText: declarationId })).toBeVisible();
    } finally {
      const restored = await apiRequest<SystemConfig>(page, "/api/admin/config", { method: "PUT", body: original }, adminToken);
      expect(restored.status, `Configuration restore returned ${restored.status}: ${JSON.stringify(restored.body)}`).toBe(200);
    }
  });

  test("organization CRUD validates duplicates, guards linked deletion, and department options follow the selected organization", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Config");
    const adminToken = await sessionToken(page);
    const organizationName = uniqueFixture("E2E Organization");
    const updatedName = `${organizationName} Updated`;
    const shortCode = `E${Date.now().toString(36).slice(-6).toUpperCase()}`;
    let createdOrganizationId: number | null = null;

    try {
      await page.getByLabel("Organization name", { exact: true }).fill(organizationName);
      await page.getByLabel("Organization short code", { exact: true }).fill(shortCode);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText(`Organization "${organizationName}" added.`, { exact: true })).toBeVisible();

      const organizations = await apiGet<Organization[]>(page, "/api/admin/config/organizations");
      const created = organizations.find((organization) => organization.name === organizationName);
      if (!created) throw new Error("Created organization was not returned by the API");
      createdOrganizationId = created.id;

      await page.getByLabel("Organization name", { exact: true }).fill(`${organizationName} Duplicate`);
      await page.getByLabel("Organization short code", { exact: true }).fill(shortCode);
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "Organization with this name or short code already exists" })).toHaveText("Organization with this name or short code already exists");

      await page.getByRole("button", { name: `Edit ${organizationName}`, exact: true }).click();
      await page.getByLabel("Edited organization name", { exact: true }).fill(updatedName);
      await page.getByRole("button", { name: `Save ${organizationName}`, exact: true }).click();
      await expect(page.getByText(`Organization "${updatedName}" updated.`, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: `Edit ${updatedName}`, exact: true })).toBeVisible();

      await page.getByRole("button", { name: "Delete Hollywoodbets Group", exact: true }).click();
      const guardedDelete = page.getByRole("dialog", { name: "Delete organization", exact: true });
      await guardedDelete.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "Cannot delete organization with associated users or declarations" })).toHaveText("Cannot delete organization with associated users or declarations");
      await expect(page.getByRole("button", { name: "Edit Hollywoodbets Group", exact: true })).toBeVisible();
      await guardedDelete.getByRole("button", { name: "Cancel", exact: true }).click();

      await page.getByRole("button", { name: `Delete ${updatedName}`, exact: true }).click();
      await page.getByRole("dialog", { name: "Delete organization", exact: true }).getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("Organization deleted.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: `Edit ${updatedName}`, exact: true })).toHaveCount(0);
      createdOrganizationId = null;

      await app.sidebar("Users");
      await page.getByRole("button", { name: "Add User", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Add user", exact: true });
      const organization = dialog.getByRole("combobox", { name: "Organization", exact: true });
      const department = dialog.getByRole("combobox", { name: "Department", exact: true });

      await organization.selectOption({ label: "HB — Hollywoodbets Group" });
      const hbDepartments = await apiGet<string[]>(page, "/api/users/departments?organizationId=1");
      await expect(department).toBeEnabled();
      await expect(department.locator("option")).toHaveText(["Select department…", ...hbDepartments]);
      await department.selectOption({ label: "Marketing" });

      await organization.selectOption({ label: "NPN — Naspers Limited" });
      const npnDepartments = await apiGet<string[]>(page, "/api/users/departments?organizationId=2");
      await expect(department).toHaveValue("");
      await expect(department.locator("option")).toHaveText(["Select department…", ...npnDepartments]);
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    } finally {
      if (createdOrganizationId !== null) {
        await deleteFixtureIfPresent(page, `/api/admin/config/organizations/${createdOrganizationId}`, adminToken);
      }
    }
  });

  test("workflow rules support create, rename validation, guarded deletion, and cleanup", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Workflows");
    const adminToken = await sessionToken(page);
    const rules = await apiGet<WorkflowRule[]>(page, "/api/admin/workflows/rules");
    const protectedRule = rules.find((rule) => rule.id === 1 || rule.id === 2);
    if (!protectedRule) throw new Error("Seeded routing-critical workflow rule was not found");
    let createdRule: WorkflowRule | null = null;

    try {
      const createResponse = page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.pathname === "/api/admin/workflows/rules" && response.request().method() === "POST";
      });
      await page.getByRole("button", { name: "New Workflow", exact: true }).click();
      const response = await createResponse;
      expect(response.status()).toBe(201);
      createdRule = (await response.json()) as WorkflowRule;

      const newRule = page.getByRole("region", { name: "New Rule", exact: true });
      await expect(newRule).toBeVisible();
      const uniqueName = uniqueFixture("E2E Workflow Rule");
      await newRule.getByRole("button", { name: "Edit New Rule", exact: true }).click();
      await newRule.getByLabel("Workflow rule name", { exact: true }).fill(uniqueName);
      await newRule.getByRole("button", { name: "Save", exact: true }).click();

      const renamedRule = page.getByRole("region", { name: uniqueName, exact: true });
      await expect(renamedRule).toBeVisible();
      await renamedRule.getByRole("button", { name: `Edit ${uniqueName}`, exact: true }).click();
      await renamedRule.getByLabel("Workflow rule name", { exact: true }).fill("");
      await renamedRule.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "Invalid request" })).toBeVisible();

      await renamedRule.getByLabel("Workflow rule name", { exact: true }).fill(protectedRule.name);
      await renamedRule.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: `A workflow rule named "${protectedRule.name}" already exists` })).toBeVisible();

      await renamedRule.getByLabel("Workflow rule name", { exact: true }).fill(uniqueName);
      await renamedRule.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Workflow rule updated.", { exact: true }).first()).toBeVisible();
      await expect(page.getByRole("region", { name: uniqueName, exact: true })).toBeVisible();

      const guardedRule = page.getByRole("region", { name: protectedRule.name, exact: true });
      await guardedRule.getByRole("button", { name: `Delete ${protectedRule.name}`, exact: true }).click();
      const guardedDialog = page.getByRole("dialog", { name: "Delete workflow rule", exact: true });
      await guardedDialog.getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "cannot be deleted" })).toBeVisible();
      await expect(guardedRule).toBeVisible();
      await guardedDialog.getByRole("button", { name: "Cancel", exact: true }).click();

      await page.getByRole("region", { name: uniqueName, exact: true }).getByRole("button", { name: `Delete ${uniqueName}`, exact: true }).click();
      await page.getByRole("dialog", { name: "Delete workflow rule", exact: true }).getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("Workflow rule deleted.", { exact: true })).toBeVisible();
      await expect(page.getByRole("region", { name: uniqueName, exact: true })).toHaveCount(0);
      createdRule = null;
    } finally {
      if (createdRule) {
        await deleteFixtureIfPresent(page, `/api/admin/workflows/rules/${createdRule.id}`, adminToken);
      }
    }
  });

  test("approval options validate input and use the stable option id for update and delete", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Approval Options");
    const adminToken = await sessionToken(page);
    const optionId = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const optionLabel = uniqueFixture("E2E Approval Option");
    const updatedLabel = `${optionLabel} Updated`;
    const updateUrls: string[] = [];
    const deleteUrls: string[] = [];
    page.on("request", (request) => {
      const path = new URL(request.url()).pathname;
      if (request.method() === "PUT" && path.startsWith("/api/admin/config/approval-options/")) updateUrls.push(path);
      if (request.method() === "DELETE" && path.startsWith("/api/admin/config/approval-options/")) deleteUrls.push(path);
    });
    let created = false;

    try {
      await page.getByRole("button", { name: "Add", exact: true }).click();
      let dialog = page.getByRole("dialog", { name: "Add approval option", exact: true });
      await dialog.getByRole("button", { name: "Add option", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "ID, value, and label are all required." })).toHaveText("ID, value, and label are all required.");

      await dialog.getByLabel("Unique ID *", { exact: true }).fill(optionId);
      await dialog.getByLabel("Value (sent to API) *", { exact: true }).fill("return");
      await dialog.getByLabel("Display label *", { exact: true }).fill(optionLabel);
      await dialog.getByRole("button", { name: "Add option", exact: true }).click();
      await expect(page.getByText("Approval option added.", { exact: true })).toBeVisible();
      created = true;

      await page.getByRole("button", { name: "Add", exact: true }).click();
      dialog = page.getByRole("dialog", { name: "Add approval option", exact: true });
      await dialog.getByLabel("Unique ID *", { exact: true }).fill(optionId);
      await dialog.getByLabel("Value (sent to API) *", { exact: true }).fill("return");
      await dialog.getByLabel("Display label *", { exact: true }).fill(`${optionLabel} Duplicate`);
      await dialog.getByRole("button", { name: "Add option", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "An option with this id already exists" })).toHaveText("An option with this id already exists");
      await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

      let row = page.getByRole("table").getByRole("row").filter({ hasText: optionLabel });
      await row.getByRole("button", { name: `Edit ${optionLabel}`, exact: true }).click();
      await row.getByLabel("Approval option value", { exact: true }).fill("return");
      await row.getByLabel("Approval option label", { exact: true }).fill(updatedLabel);
      await row.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Approval option updated.", { exact: true }).first()).toBeVisible();
      expect(updateUrls).toEqual([`/api/admin/config/approval-options/${optionId}`]);

      row = page.getByRole("table").getByRole("row").filter({ hasText: updatedLabel });
      await row.getByRole("button", { name: `Edit ${updatedLabel}`, exact: true }).click();
      await row.getByLabel("Approval option label", { exact: true }).fill("");
      await row.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.locator("main").getByRole("alert").filter({ hasText: "Value and label are required." })).toHaveText("Value and label are required.");
      expect(updateUrls).toHaveLength(1);
      await row.getByLabel("Approval option label", { exact: true }).fill(updatedLabel);
      await row.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("Approval option updated.", { exact: true }).first()).toBeVisible();

      const persisted = await apiGet<ApprovalOption[]>(page, "/api/admin/config/approval-options");
      expect(persisted.find((option) => option.id === optionId)).toEqual({ id: optionId, value: "return", label: updatedLabel });

      await page.getByRole("button", { name: `Delete ${updatedLabel}`, exact: true }).click();
      await page.getByRole("dialog", { name: "Delete approval option", exact: true }).getByRole("button", { name: "Delete", exact: true }).click();
      await expect(page.getByText("Approval option deleted.", { exact: true })).toBeVisible();
      expect(deleteUrls).toEqual([`/api/admin/config/approval-options/${optionId}`]);
      await expect(page.getByRole("table").getByRole("row").filter({ hasText: updatedLabel })).toHaveCount(0);
      created = false;
    } finally {
      if (created) {
        await deleteFixtureIfPresent(page, `/api/admin/config/approval-options/${optionId}`, adminToken);
      }
    }
  });

  test("dashboard status cards filter the list and the queue badge matches the authoritative queue before and after a decision", async ({ page }) => {
    const app = new AppPage(page);
    const counterparty = uniqueFixture("E2E Dashboard Supplies");
    const declarationId = await createGiftDeclaration(page, counterparty, 100);

    await app.login(USERS.sipho.email);
    await app.sidebar("Dashboard");
    for (const status of ["Pending", "Approved", "Returned", "Declined"]) {
      const declarations = await apiGet<Array<{ status: string }>>(page, `/api/declarations?status=${status}`);
      await page.getByText(status, { exact: false }).first().click();
      await expect(page.locator("p").filter({ hasText: "Total Declarations" })).toHaveText(
        new RegExp(`^${declarations.length}\\s+Total Declarations$`),
      );
    }

    const initialQueue = await apiGet<QueueResponse>(page, "/api/workflows/queue");
    const queueButton = page.locator("main").getByRole("button", { name: /Approval Queue/ });
    await expect(queueButton).toHaveText(new RegExp(`Approval Queue\\s+${initialQueue.total}$`));
    await queueButton.click();
    await expect(page.getByText(/actionable approvals awaiting your review/)).toHaveText(
      `${initialQueue.total} actionable approvals awaiting your review`,
    );
    await expect(page.getByText(/^Showing \d+ declarations$/).last()).toHaveText(`Showing ${initialQueue.total} declarations`);
    await app.search(declarationId);
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: declarationId })).toBeVisible();

    await app.clickReviewFor(declarationId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.sidebar("Dashboard");
    const remainingQueue = await apiGet<QueueResponse>(page, "/api/workflows/queue");
    expect(remainingQueue.total).toBe(initialQueue.total - 1);
    await expect(page.locator("main").getByRole("button", { name: /Approval Queue/ })).toHaveText(
      new RegExp(`Approval Queue\\s+${remainingQueue.total}$`),
    );
    await page.locator("main").getByRole("button", { name: /Approval Queue/ }).click();
    await app.search(declarationId);
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: declarationId })).toHaveCount(0);
    await expect(page.getByRole("table").getByText("No declarations match your filters.", { exact: true })).toBeVisible();
  });

  test("report date, department, and status filters reconcile table totals with API data", async ({ page }) => {
    const counterparty = uniqueFixture("E2E Report Supplies");
    await createGiftDeclaration(page, counterparty, 1500);
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await app.sidebar("Reports");

    await page.getByLabel("Start Date", { exact: true }).fill("2026-07-15");
    await page.getByLabel("End Date", { exact: true }).fill("2026-07-15");
    await page.getByLabel("Department", { exact: true }).selectOption({ label: "Marketing" });
    const filteredResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/reports/high-value"
        && url.searchParams.get("startDate") === "2026-07-15"
        && url.searchParams.get("endDate") === "2026-07-15"
        && url.searchParams.get("department") === "Marketing"
        && url.searchParams.get("status") === "Pending";
    });
    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Pending" });
    await filteredResponse;

    const statusBreakdown = await apiGet<Record<string, number>>(page, reportPath("/api/reports/status-breakdown", "Pending"));
    const highValueData = await apiGet<HighValueReportRow[]>(page, reportPath("/api/reports/high-value", "Pending"));
    const counterpartyData = await apiGet<CounterpartyReportRow[]>(page, reportPath("/api/reports/counterparty-concentration", "Pending"));
    expect(statusBreakdown.Pending).toBeGreaterThan(0);

    const statusCard = page.getByRole("heading", { name: "Status Breakdown", exact: true }).locator("..");
    await expect(statusCard.getByText("Pending", { exact: true }).locator("..")).toContainText(String(statusBreakdown.Pending));

    const apiHighValue = highValueData.find((row) => row.employee === USERS.nomvula.name);
    if (!apiHighValue) throw new Error("Filtered high-value API data did not include the declaration owner");
    const highValueTable = page.getByRole("heading", { name: "High-Value Gifts Report", exact: true }).locator("xpath=../..").getByRole("table");
    const highValueRow = highValueTable.getByRole("row").filter({ hasText: USERS.nomvula.name });
    await expect(highValueRow.getByRole("cell").nth(2)).toHaveText(String(apiHighValue.declarationCount));
    await expect(highValueRow.getByRole("cell").nth(3)).toHaveText(formatRand(apiHighValue.totalValue));
    await expect(highValueRow.getByRole("cell").nth(4)).toHaveText(formatRand(apiHighValue.averageValue));
    await expect(highValueRow.getByRole("cell").nth(5)).toHaveText(String(apiHighValue.totalGift));
    await expect(highValueRow.getByRole("cell").nth(6)).toHaveText(String(apiHighValue.totalHospitality));
    await expect(highValueRow.getByRole("cell").nth(7)).toHaveText(String(apiHighValue.totalEntertainment));
    await expect(highValueRow.getByRole("cell").nth(8)).toHaveText(apiHighValue.mostFrequentSupplier);

    await page.getByRole("button", { name: "Counterparty Concentration Report", exact: true }).click();
    const apiCounterparty = counterpartyData.find((row) => row.counterparty === counterparty);
    if (!apiCounterparty) throw new Error("Filtered counterparty API data did not include the unique fixture");
    const counterpartyTable = page.getByRole("heading", { name: "Counterparty Concentration Report", exact: true }).locator("xpath=../..").getByRole("table");
    const counterpartyRow = counterpartyTable.getByRole("row").filter({ hasText: counterparty });
    await expect(counterpartyRow.getByRole("cell").nth(1)).toHaveText(String(apiCounterparty.count));
    await expect(counterpartyRow.getByRole("cell").nth(2)).toHaveText(formatRand(apiCounterparty.totalValue));
    await expect(counterpartyRow.getByRole("cell").nth(3)).toHaveText(formatRand(apiCounterparty.avgValue));

    const emptyResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/reports/counterparty-concentration" && url.searchParams.get("status") === "Declined";
    });
    await page.getByLabel("Status", { exact: true }).selectOption({ label: "Declined" });
    await emptyResponse;
    const emptyData = await apiGet<CounterpartyReportRow[]>(page, reportPath("/api/reports/counterparty-concentration", "Declined"));
    expect(emptyData).toHaveLength(0);
    await expect(page.getByText("No records for the selected range.", { exact: true })).toBeVisible();
  });

  test("dashboard loading is visible while the API is delayed and resolves to real metrics", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await page.route("**/api/admin/dashboard", async (route) => {
      await gate;
      await route.continue();
    });

    try {
      await login(page, USERS.admin.email);
      await expect(page.getByText("Loading dashboard…", { exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Admin Dashboard", exact: true })).toHaveCount(0);
      release();
      await expect(page.getByRole("heading", { name: "Admin Dashboard", exact: true })).toBeVisible();
      await expect(page.getByText("Total Users", { exact: false }).first()).toBeVisible();
    } finally {
      release();
      await page.unroute("**/api/admin/dashboard");
    }
  });

  test("workflow server, network, and timeout failures are visible and recover after navigation", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    const failures = [
      { kind: "server", message: /Injected workflow outage/ },
      { kind: "network", message: /Failed to fetch|NetworkError|network/i },
      { kind: "timeout", message: /Failed to fetch|NetworkError|timed out|timeout/i },
    ] as const;

    for (const failure of failures) {
      await app.sidebar("Dashboard");
      await page.route("**/api/admin/workflows/rules", async (route) => {
        if (failure.kind === "server") {
          await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "Injected workflow outage" }) });
        } else {
          await route.abort(failure.kind === "network" ? "failed" : "timedout");
        }
      });
      try {
        await app.sidebar("Workflows");
        await expect(page.locator("main").getByRole("alert").filter({ hasText: failure.message })).toBeVisible();
      } finally {
        await page.unroute("**/api/admin/workflows/rules");
      }
      await app.sidebar("Dashboard");
      await app.sidebar("Workflows");
      await expect(page.getByRole("heading", { name: "Approval Workflows", exact: true })).toBeVisible();
      await expect(page.getByRole("region").first()).toBeVisible();
    }
  });

  test("unauthorized API and direct forbidden-screen attempts stay denied and recover when authorization is restored", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.admin.email);
    await page.route("**/api/admin/users", async (route) => {
      await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Insufficient permissions" }) });
    });
    try {
      await app.sidebar("Users");
      await expect(page.getByText("Insufficient permissions", { exact: true })).toBeVisible();
    } finally {
      await page.unroute("**/api/admin/users");
    }
    await app.sidebar("Dashboard");
    await app.sidebar("Users");
    await expect(page.getByRole("table")).toBeVisible();

    await app.login(USERS.nomvula.email);
    const navigation = page.locator("aside nav:visible");
    await expect(navigation.getByRole("button", { name: "Users", exact: true })).toHaveCount(0);
    await page.goto("/admin-users", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "My Declarations", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "User Management", exact: true })).toHaveCount(0);
    const forbidden = await apiRequest<{ error: string }>(page, "/api/admin/users");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ error: "Insufficient permissions" });
  });

  test("an expired session returns to sign-in and quick login recovers the session", async ({ page }) => {
    await login(page, USERS.nomvula.email);
    await page.route("**/api/auth/me", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Unauthorized" }) });
    });
    try {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Welcome back!", exact: true })).toBeVisible();
      await expect(page.locator("aside nav, nav")).toHaveCount(0);
      await expect(page.getByRole("region", { name: "Developer testing" })).toBeVisible();
    } finally {
      await page.unroute("**/api/auth/me");
    }

    const developerTesting = page.getByRole("region", { name: "Developer testing" });
    await developerTesting.getByRole("combobox").selectOption(USERS.nomvula.email);
    await developerTesting.getByRole("button", { name: "Quick login", exact: true }).click();
    await expect(page.getByRole("heading", { name: "My Declarations", exact: true })).toBeVisible();
  });
});
