import { test, expect } from "@playwright/test";
import { USERS, NewDeclarationPage, login, uniqueFixture } from "./common-helpers";

test.describe("Mobile interactions", () => {
  test.skip(({ isMobile }) => !isMobile, "Runs in the mobile Playwright project");

  test("team member can open the declaration form and see usable controls", async ({ page }) => {
    await login(page, USERS.nomvula.email);
    await page.getByRole("button", { name: "New Declaration", exact: true }).first().click();
    // Scope to main content: the hidden desktop sidebar duplicates labels.
    await expect(page.locator("main").getByText(/New Declaration/i).first()).toBeVisible();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("main button").filter({ hasText: "Submit Declaration" })).toBeVisible();
  });

  test("mobile sidebar remains usable for an approver", async ({ page }) => {
    await login(page, USERS.sipho.email);
    // Mobile renders the compact bottom navigation, not the desktop aside.
    await expect(page.locator("nav").last()).toBeVisible();
    await page.getByRole("button", { name: "Approval Queue", exact: true }).first().click();
    await expect(page.locator("main").getByText(/Approval Queue/i).first()).toBeVisible();
  });

  test("team member can search declaration cards and recover from empty results", async ({ page }) => {
    await login(page, USERS.nomvula.email);
    await page.getByRole("button", { name: "My Declarations", exact: true }).first().click();
    await expect(page.locator("main").getByRole("heading", { name: "My Declarations" })).toBeVisible();

    const search = page.getByPlaceholder("ID, Counterparty, Employee or Approver", { exact: true });
    await search.fill("NO-MOBILE-GHE-999999");
    await expect(page.locator("main").getByText("No declarations found", { exact: true }).first()).toBeVisible();

    await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
    await search.fill("Nike SA");
    await expect(page.locator("main").getByText("GHE-2025-0011", { exact: true }).first()).toBeVisible();
    await expect(page.locator("main").getByText("Nike SA", { exact: true }).first()).toBeVisible();
  });

  test("team member can save and continue a partial draft on mobile", async ({ page }) => {
    const declaration = new NewDeclarationPage(page);
    const counterparty = uniqueFixture("E2E Mobile Draft Supplies");
    const description = `Mobile partial draft for ${counterparty}`;

    await login(page, USERS.nomvula.email);
    await declaration.open();
    await declaration.autoFilled(USERS.nomvula.name, USERS.sipho.name);
    await declaration.select("What category does the nature", "Gift");
    await declaration.fill("Name of the Supplier", counterparty);
    await declaration.fill("Please describe the nature", description);
    await page.getByRole("button", { name: "Save Draft", exact: true }).click();
    await expect(page.getByText("Draft saved.", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "My Declarations", exact: true }).first().click();
    await page.getByPlaceholder("ID, Counterparty, Employee or Approver", { exact: true }).fill(counterparty);
    const draftCard = page.locator("main").getByText(counterparty, { exact: true }).first();
    await expect(draftCard).toBeVisible();
    await page.locator("main").getByRole("button", { name: "Continue", exact: true }).first().click();
    await declaration.waitForDraftDescription(description);
    await expect(declaration.page.getByLabel("Name of the Supplier, Customer, Team Member or Public Official", { exact: true })).toHaveValue(counterparty);
  });
});
