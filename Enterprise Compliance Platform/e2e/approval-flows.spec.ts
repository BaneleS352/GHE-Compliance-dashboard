import { test, expect, Page, BrowserContext } from "@playwright/test";

const LOGIN_DROPDOWN_INDEX: Record<string, number> = {
  "nomvula@hb.co.za": 0,
  "sipho@hb.co.za": 1,
  "lindiwe@hb.co.za": 2,
  "sandile@hb.co.za": 3,
  "admin@hb.co.za": 4,
};

async function login(page: Page, email: string) {
  await page.goto("/");
  await page.waitForSelector("select");
  await page.selectOption("select", String(LOGIN_DROPDOWN_INDEX[email]));
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000);
}

async function sidebarClick(page: Page, label: string) {
  await page.locator(`aside nav button:has-text("${label}")`).click();
  await page.waitForTimeout(500);
}

async function searchAndReview(page: Page, declarationId: string) {
  await page.locator('input[placeholder="Search declarations..."]').fill(declarationId);
  await page.waitForTimeout(1000);
  await page.locator("table button:has-text('Review')").click();
  await page.waitForTimeout(1000);
}

async function pickDecision(page: Page, label: string) {
  await page.locator(`div.bg-gray-50 button:has-text("${label}")`).first().click();
  await page.waitForTimeout(300);
}

async function submit(page: Page) {
  await page.locator('button:has-text("Submit Decision")').click();
  await expect(page.getByText("Decision submitted successfully")).toBeVisible({ timeout: 10000 });
}

async function verifyStatus(page: Page, declarationId: string, status: string) {
  await page.waitForTimeout(2500);
  await sidebarClick(page, "All Declarations");
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="Declaration ID, Type, Counterparty or Status"]').fill(declarationId);
  await page.waitForTimeout(1000);
  await expect(page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible();
  await expect(page.locator(`table td span:has-text("${status}")`).first()).toBeVisible();
}

async function fillField(page: Page, label: string, value: string) {
  await page.locator(`label:has-text("${label}") + input`).fill(value);
}

async function selectOption(page: Page, label: string, option: string) {
  await page.locator(`div:has(> label:has-text("${label}")) [role="combobox"]`).click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await page.waitForTimeout(200);
}

test.describe("Approval workflow e2e", () => {
  test.beforeEach(async ({ context }) => {
    await context.addInitScript(() => localStorage.clear());
  });

  test("Full approval: LM -> HR -> CEO (high-value GHE-2024-0047)", async ({ page }) => {
    // LM (Sipho) accepts
    await login(page, "sipho@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0047");
    await pickDecision(page, "Accept");
    await submit(page);

    // HR (Lindiwe) accepts
    await login(page, "lindiwe@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0047");
    await pickDecision(page, "Accept");
    await submit(page);

    // CEO (Sandile) accepts
    await login(page, "sandile@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0047");
    await pickDecision(page, "Accept");
    await submit(page);

    await verifyStatus(page, "GHE-2024-0047", "Approved");
  });

  test("Rejection at HR step (GHE-2024-0045)", async ({ page }) => {
    await login(page, "sipho@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0045");
    await pickDecision(page, "Accept");
    await submit(page);

    await login(page, "lindiwe@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0045");
    await pickDecision(page, "Reject");
    await submit(page);

    await verifyStatus(page, "GHE-2024-0045", "Declined");
  });

  test("Info Request at HR step (GHE-2024-0044)", async ({ page }) => {
    await login(page, "sipho@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0044");
    await pickDecision(page, "Accept");
    await submit(page);

    await login(page, "lindiwe@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await searchAndReview(page, "GHE-2024-0044");
    await pickDecision(page, "Return for More Info");
    await submit(page);

    await verifyStatus(page, "GHE-2024-0044", "Info Requested");
  });

  test("Team member views declaration with workflow timeline (GHE-2025-0009)", async ({ page }) => {
    await login(page, "nomvula@hb.co.za");
    await sidebarClick(page, "My Declarations");
    await page.locator('input[placeholder="Declaration ID, Type, Counterparty or Status"]').fill("GHE-2025-0009");
    await page.waitForTimeout(1000);
    await page.locator("table button:has-text('View')").click();
    await page.waitForTimeout(1000);
    await expect(page.getByText("Approval Workflow")).toBeVisible();
    await expect(page.getByText("Completed").first()).toBeVisible();
  });

  test("Team member creates and submits a declaration", async ({ page }) => {
    await login(page, "nomvula@hb.co.za");
    await sidebarClick(page, "New Declaration");

    // Auto-filled fields from user context
    await expect(page.locator('label:has-text("Team Member Name") + input')).toHaveValue("Nomvula Dlamini");
    await expect(page.locator('label:has-text("Manager Name") + input')).toHaveValue("Sipho Nkosi", { timeout: 10000 });

    // Set received/given to "Given"
    await page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
    await page.getByRole("option", { name: "Given" }).click();
    await page.waitForTimeout(200);

    // Fill declaration details
    await selectOption(page, "Who did you give it to?", "Supplier");
    await fillField(page, "Name of the Supplier", "E2E Test Supplies");
    await fillField(page, "Name of the person giving", "Test Contact");
    await selectOption(page, "Are we currently negotiating", "No");
    await selectOption(page, "Is the Supplier or potential Supplier", "No");
    await selectOption(page, "Is there an existing or imminent", "No");

    // Fill GHE details
    await selectOption(page, "What category does the nature", "Gift");
    await page.locator("textarea").fill("E2E test gift for automated testing");
    await selectOption(page, "Reason/Occasion for the gift", "Business Meeting");
    await page.locator('input[type="date"]').fill("2026-07-15");
    await selectOption(page, "Number of instances", "1");
    await page.locator('input[placeholder="0.00"]').fill("100");

    // Submit
    await page.locator('button:has-text("Submit Declaration")').click();
    await expect(page.getByText("Declaration Submitted!")).toBeVisible({ timeout: 15000 });

    const idText = await page.locator("span.font-mono.font-bold").textContent();
    expect(idText).toBeTruthy();

    // Dismiss modal
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);

    // Log in as Sipho (LM) and verify the declaration appears in approval queue
    const declId = idText!.trim();
    await login(page, "sipho@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await page.locator('input[placeholder="Search declarations..."]').fill(declId);
    await page.waitForTimeout(1000);
    await expect(page.locator(`table td:has-text("${declId}")`).first()).toBeVisible();
    await expect(page.locator(`table td span:has-text("Pending")`).first()).toBeVisible();
  });

  test("Approver creates and submits a declaration", async ({ page }) => {
    await login(page, "lindiwe@hb.co.za");
    await sidebarClick(page, "New Declaration");

    // Auto-filled fields
    await expect(page.locator('label:has-text("Team Member Name") + input')).toHaveValue("Lindiwe Zulu");
    await expect(page.locator('label:has-text("Manager Name") + input')).toHaveValue("Sandile Shabalala", { timeout: 10000 });

    // Set received/given to "Received"
    await page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
    await page.getByRole("option", { name: "Received" }).click();
    await page.waitForTimeout(200);

    // Fill declaration details
    await selectOption(page, "Who did you receive it from?", "Supplier");
    await fillField(page, "Name of the Supplier", "E2E Approver Supplies");
    await fillField(page, "Name of the person giving", "Approver Contact");
    await selectOption(page, "Are we currently negotiating", "N/A");
    await selectOption(page, "Is the Supplier or potential Supplier", "N/A");
    await selectOption(page, "Is there an existing or imminent", "Yes");

    // Fill GHE details
    await selectOption(page, "What category does the nature", "Hospitality");
    await page.locator("textarea").fill("E2E test hospitality for approver flow");
    await selectOption(page, "Reason/Occasion for the gift", "Milestone");
    await page.locator('input[type="date"]').fill("2026-07-15");
    await selectOption(page, "Number of instances", "1");
    await page.locator('input[placeholder="0.00"]').fill("100");

    // Submit
    await page.locator('button:has-text("Submit Declaration")').click();
    await expect(page.getByText("Declaration Submitted!")).toBeVisible({ timeout: 15000 });

    const idText = await page.locator("span.font-mono.font-bold").textContent();
    expect(idText).toBeTruthy();

    // Dismiss modal
    await page.getByRole("button", { name: "Close" }).click();
    await page.waitForTimeout(500);

    // Login as Sandile (Lindiwe's LM) and verify declaration appears in approval queue
    const declId = idText!.trim();
    await login(page, "sandile@hb.co.za");
    await sidebarClick(page, "Approval Queue");
    await page.locator('input[placeholder="Search declarations..."]').fill(declId);
    await page.waitForTimeout(1000);
    await expect(page.locator(`table td:has-text("${declId}")`).first()).toBeVisible();
    await expect(page.locator(`table td span:has-text("Pending")`).first()).toBeVisible();
  });

  test("Admin creates a new user", async ({ page }) => {
    await login(page, "admin@hb.co.za");
    await sidebarClick(page, "Users");

    // Verify admin sidebar
    await expect(page.locator('aside nav button:has-text("Dashboard")')).toBeVisible();
    await expect(page.locator('aside nav button:has-text("Users")')).toBeVisible();
    await expect(page.locator('aside nav button:has-text("Workflows")')).toBeVisible();
    await expect(page.locator('aside nav button:has-text("Dropdowns")')).toBeVisible();
    await expect(page.locator('aside nav button:has-text("Config")')).toBeVisible();
    await expect(page.locator('aside nav button:has-text("Reports")')).toBeVisible();

    const ts = Date.now();
    const userName = `E2E User ${ts}`;
    const userEmail = `e2e-${ts}@hb.co.za`;

    // Handle prompt dialogs for creating a user
    page.on("dialog", (dialog) => {
      const msg = dialog.message();
      if (msg.startsWith("User name")) dialog.accept(userName);
      else if (msg.startsWith("Email")) dialog.accept(userEmail);
      else if (msg.startsWith("Role")) dialog.accept("approver");
      else if (msg.startsWith("Department")) dialog.accept("Marketing");
      else dialog.dismiss();
    });

    await page.getByRole("button", { name: "Add User" }).click();
    await page.waitForTimeout(2000);

    // Verify user appears in the table — scope to td cells to avoid hidden mobile rows
    await expect(page.locator(`table td:has-text("${userName}")`)).toBeVisible();
    await expect(page.locator(`table td:has-text("${userEmail}")`)).toBeVisible();
  });
});
