import { test, expect, type Page } from "@playwright/test";
import { USERS, AppPage, NewDeclarationPage, uniqueFixture } from "./common-helpers";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.clear(); } catch { /* storage may be unavailable */ }
  });
});

async function actionableQueueTotal(page: Page): Promise<number> {
  const subtitle = page.getByText(/actionable approvals awaiting your review/);
  await expect(subtitle).toBeVisible();
  const text = await subtitle.textContent();
  const total = text?.match(/\d+/)?.[0];
  if (!total) throw new Error(`Could not read approval queue total from: ${text ?? ""}`);
  return Number(total);
}

async function createLowValueDeclaration(page: Page, counterparty: string): Promise<string> {
  const app = new AppPage(page);
  const declaration = new NewDeclarationPage(page);
  await app.login(USERS.nomvula.email);
  await app.sidebar("New Declaration");
  await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
  await declaration.completeLowValueGift(counterparty, `Automated gift from ${counterparty}`);
  await declaration.submit();
  const id = await declaration.getId();
  expect(id).toMatch(/^GHE-/);
  await declaration.closeModal();
  return id;
}

test.describe("Declaration contracts", () => {
  test("team member profile identity is populated and locked", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");

    await expect(page.getByLabel("Team Member Name", { exact: true })).toHaveValue(USERS.nomvula.name);
    await expect(page.getByLabel("Team Member Code", { exact: true })).toHaveValue("HB-204478");
    await expect(page.getByLabel("Team Member Role/Position", { exact: true })).toHaveValue("Senior Brand Manager");

    const company = page.getByLabel("Company (from your profile)", { exact: true });
    const department = page.getByLabel("Department (from your profile)", { exact: true });
    const manager = page.getByLabel("Approving Manager Name", { exact: true });
    await expect(company).toHaveValue("Hollywoodbets Group");
    await expect(department).toHaveValue("Marketing");
    await expect(manager).toHaveValue(USERS.sipho.name);
    for (const field of [company, department, manager]) {
      await expect(field).toBeDisabled();
      await expect(field).toHaveAttribute("readonly", "");
    }
  });

  test("role navigation agrees with admin API authorization", async ({ page }) => {
    const app = new AppPage(page);
    const personas = [
      {
        user: USERS.nomvula,
        links: ["New Declaration", "My Declarations"],
        hidden: ["Dashboard", "Approval Queue", "All Declarations", "Users", "Workflows", "Config", "Reports", "Approval Options"],
        status: 403,
      },
      {
        user: USERS.sipho,
        links: ["Dashboard", "New Declaration", "Approval Queue", "All Declarations", "Reports"],
        hidden: ["Users", "Workflows", "Config", "Approval Options"],
        status: 403,
      },
      {
        user: USERS.admin,
        links: ["Dashboard", "Users", "Workflows", "Config", "Reports", "Approval Options"],
        hidden: ["New Declaration", "My Declarations", "Approval Queue", "All Declarations"],
        status: 200,
      },
    ];

    for (const persona of personas) {
      await app.login(persona.user.email);
      const navigation = page.locator("aside nav:visible");
      await expect(navigation.getByRole("button")).toHaveText(persona.links);
      for (const label of persona.hidden) {
        await expect(navigation.getByRole("button", { name: label, exact: true })).toHaveCount(0);
      }

      const response = await page.evaluate(async () => {
        const token = sessionStorage.getItem("e2e.auth.token");
        const result = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body: unknown = await result.json();
        return { status: result.status, body };
      });
      expect(response.status).toBe(persona.status);
      if (persona.status === 403) {
        expect(response.body).toEqual(expect.objectContaining({ error: "Insufficient permissions" }));
      } else {
        expect(response.body).toEqual(expect.arrayContaining([
          expect.objectContaining({ email: USERS.admin.email, role: "admin" }),
        ]));
      }
    }
  });

  test("invalid and over-limit submissions stay client-side", async ({ page }) => {
    const app = new AppPage(page);
    const declaration = new NewDeclarationPage(page);
    const declarationPosts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname === "/api/declarations") {
        declarationPosts.push(request.url());
      }
    });

    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");
    await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
    await page.getByRole("button", { name: "Submit Declaration", exact: true }).click();

    const counterparty = page.getByLabel("Name of the Supplier, Customer, Team Member or Public Official", { exact: true });
    await expect(counterparty).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#counterparty-error")).toHaveText("Required");
    await expect(page.getByRole("heading", { name: "Declaration Submitted!" })).toHaveCount(0);
    expect(declarationPosts).toHaveLength(0);

    await declaration.number("Rand Value or Equivalent", "1000001");
    const limitError = page.getByRole("alert").filter({ hasText: "Maximum value exceeded" });
    await expect(limitError).toContainText("R1 000 000");
    await page.getByRole("button", { name: "Submit Declaration", exact: true }).click();
    await expect(limitError).toBeVisible();
    await expect(page.getByRole("heading", { name: "Declaration Submitted!" })).toHaveCount(0);
    expect(declarationPosts).toHaveLength(0);
  });

  test("declaration search and date filters recover from empty results", async ({ page }) => {
    const app = new AppPage(page);
    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");

    const search = page.getByPlaceholder("ID, Counterparty, Employee or Approver", { exact: true });
    const table = page.getByRole("table");
    const resultCount = page.locator("p").filter({ hasText: "Showing 0 declarations" }).last();
    const clearFilters = page.getByRole("button", { name: "Clear Filters", exact: true });

    await search.fill("NO-SUCH-GHE-999999");
    await expect(table.getByText("No declarations found", { exact: true })).toBeVisible();
    await expect(resultCount).toBeVisible();

    await clearFilters.click();
    await search.fill("Nike SA");
    const seededRow = table.getByRole("row").filter({ hasText: "GHE-2025-0011" });
    await expect(seededRow).toBeVisible();
    await expect(seededRow).toContainText("Nike SA");

    await page.locator('input[type="date"]').first().fill("2099-01-01");
    await expect(table.getByText("No declarations found", { exact: true })).toBeVisible();
    await expect(resultCount).toBeVisible();

    await clearFilters.click();
    await expect(table.getByRole("row").filter({ hasText: "GHE-2025-0011" })).toBeVisible();
  });

  test("a partial draft persists, resumes, and submits", async ({ page }) => {
    const app = new AppPage(page);
    const declaration = new NewDeclarationPage(page);
    const counterparty = uniqueFixture("E2E Draft Supplies");
    const description = `Partial draft for ${counterparty}`;

    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");
    await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
    await declaration.select("What category does the nature", "Gift");
    await declaration.fill("Name of the Supplier", counterparty);
    await declaration.fill("Please describe the nature", description);
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();

    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();
    await expect(page.getByText("Draft saved successfully", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Declaration Submitted!" })).toHaveCount(0);

    await app.sidebar("My Declarations");
    await app.search(counterparty);
    const draftRow = page.getByRole("table").getByRole("row").filter({ hasText: counterparty });
    await expect(draftRow).toContainText("Draft");
    await draftRow.getByRole("button", { name: "Edit", exact: true }).click();
    await declaration.waitForDraftDescription(description);
    await expect(declaration.page.getByLabel("Name of the Supplier, Customer, Team Member or Public Official", { exact: true })).toHaveValue(counterparty);

    await declaration.completeLowValueGift(counterparty, description);
    await declaration.submit();
    const id = await declaration.getId();
    expect(id).toMatch(/^GHE-/);
    await expect(page.getByText("Pending Approval", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "View Declaration", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Approval Workflow" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit Decision", exact: true })).toHaveCount(0);
  });
});

test.describe("Approval queue contracts", () => {
  test("filters narrow the queue without changing its authoritative total", async ({ page }) => {
    const app = new AppPage(page);
    const counterparty = uniqueFixture("E2E Queue Filter Supplies");
    const id = await createLowValueDeclaration(page, counterparty);

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.search(id);
    const row = page.getByRole("table").getByRole("row").filter({ hasText: id });
    await expect(row).toContainText(USERS.nomvula.name);
    await expect(row).toContainText("Marketing");
    await expect(row.getByText("Low", { exact: true })).toBeVisible();
    const total = await actionableQueueTotal(page);

    const employeeFilter = page.locator("select").filter({ hasText: "All Employees" });
    const departmentFilter = page.locator("select").filter({ hasText: "All Departments" });
    const priorityFilter = page.locator("select").filter({ hasText: "All Priorities" });
    await employeeFilter.selectOption({ label: USERS.nomvula.name });
    await departmentFilter.selectOption({ label: "Marketing" });
    await priorityFilter.selectOption({ label: "Low" });
    await expect(row).toBeVisible();
    await expect(page.getByText(/actionable approvals awaiting your review/)).toHaveText(
      `${total} actionable approvals awaiting your review`,
    );

    await priorityFilter.selectOption({ label: "High" });
    await expect(page.getByRole("table").getByText("No declarations match your filters.", { exact: true })).toBeVisible();
    await expect(page.getByText(/actionable approvals awaiting your review/)).toHaveText(
      `${total} actionable approvals awaiting your review`,
    );

    await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
    await app.search(id);
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: id })).toBeVisible();
  });

  test("an approval refreshes the queue and decrements its total", async ({ page }) => {
    const app = new AppPage(page);
    const id = await createLowValueDeclaration(page, uniqueFixture("E2E Queue Refresh Supplies"));

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    const initialTotal = await actionableQueueTotal(page);
    await app.clickReviewFor(id);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.sidebar("Approval Queue");
    await app.search(id);
    await expect(page.getByRole("table").getByRole("row").filter({ hasText: id })).toHaveCount(0);
    await expect(page.getByRole("table").getByText("No declarations match your filters.", { exact: true })).toBeVisible();
    await expect(page.getByText(/actionable approvals awaiting your review/)).toHaveText(
      `${initialTotal - 1} actionable approvals awaiting your review`,
    );
  });
});

test.describe("Admin user contracts", () => {
  test("duplicate validation and the user lifecycle are visible end to end", async ({ page }) => {
    const app = new AppPage(page);
    const name = uniqueFixture("E2E Lifecycle User");
    const updatedName = `${name} Updated`;
    const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@hb.co.za`;

    await app.login(USERS.admin.email);
    await app.sidebar("Users");

    await page.getByRole("button", { name: "Add User", exact: true }).click();
    let dialog = page.getByRole("dialog", { name: "Add user", exact: true });
    await dialog.getByLabel("Name *", { exact: true }).fill(name);
    await dialog.getByLabel("Email *", { exact: true }).fill(email);
    await dialog.getByRole("combobox", { name: "Organization", exact: true }).selectOption({ label: "HB — Hollywoodbets Group" });
    const department = dialog.getByRole("combobox", { name: "Department", exact: true });
    await expect(department).toBeEnabled();
    await department.selectOption({ label: "Marketing" });
    await dialog.getByRole("button", { name: "Add user", exact: true }).click();

    await expect(page.getByText(`User "${name}" added.`, { exact: true })).toBeVisible();
    await page.getByPlaceholder("Search by name, email, or ID...", { exact: true }).fill(email);
    const userRow = page.getByRole("table").getByRole("row").filter({ hasText: email });
    await expect(userRow).toContainText(name);
    await expect(userRow).toContainText("Active");

    await page.getByRole("button", { name: "Add User", exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Add user", exact: true });
    await dialog.getByLabel("Name *", { exact: true }).fill(`${name} Duplicate`);
    await dialog.getByLabel("Email *", { exact: true }).fill(email);
    await dialog.getByRole("button", { name: "Add user", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("A user with this email already exists");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();

    await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
    dialog = page.getByRole("dialog", { name: "Edit user", exact: true });
    await dialog.getByLabel("Name *", { exact: true }).fill(updatedName);
    await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByText(`User "${updatedName}" updated.`, { exact: true })).toBeVisible();
    await expect(userRow).toContainText(updatedName);

    await page.getByRole("button", { name: `Disable ${updatedName}`, exact: true }).click();
    await expect(page.getByText(`${updatedName} disabled.`, { exact: true })).toBeVisible();
    await expect(userRow).toContainText("Disabled");

    await page.getByRole("button", { name: `Enable ${updatedName}`, exact: true }).click();
    await expect(page.getByText(`${updatedName} enabled.`, { exact: true })).toBeVisible();
    await expect(userRow).toContainText("Active");

    await page.getByRole("button", { name: `Delete ${updatedName}`, exact: true }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete user", exact: true });
    await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(`User "${updatedName}" deleted.`, { exact: true })).toBeVisible();
    await expect(userRow).toHaveCount(0);
  });
});
