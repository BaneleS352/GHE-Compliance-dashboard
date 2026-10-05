import { test, expect } from "@playwright/test";
import { USERS, login } from "./common-helpers";

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
});
