import { expect, type Page } from "@playwright/test";

export const USERS = {
  nomvula:  { email: "nomvula@hb.co.za",  role: "teamMember", name: "Nomvula Dlamini" },
  sipho:    { email: "sipho@hb.co.za",    role: "approver",   name: "Sipho Nkosi" },
  lindiwe:  { email: "lindiwe@hb.co.za",  role: "approver",   name: "Lindiwe Zulu" },
  sandile:  { email: "sandile@hb.co.za",  role: "approver",   name: "Sandile Shabalala" },
  admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
};

export const LOGIN_INDEX: Record<string, number> = {
  "nomvula@hb.co.za": 0,
  "sipho@hb.co.za": 1,
  "lindiwe@hb.co.za": 4,
  "sandile@hb.co.za": 3,
  "admin@hb.co.za": 5,
};

export async function login(page: Page, email: string) {
  await page.goto("/");
  await page.waitForSelector("select", { timeout: 10000 });
  await page.selectOption("select", String(LOGIN_INDEX[email]));
  await page.click('button[type="submit"]');
  // Desktop renders the sidebar inside <aside>; mobile renders the compact
  // navigation as a top-level <nav>.
  await page.waitForSelector("aside nav, nav", { timeout: 15000 });
}

export async function clickSidebar(page: Page, label: string) {
  await page.locator(`aside nav button:has-text("${label}"):visible, nav button:has-text("${label}"):visible`).first().click();
}

export class AppPage {
  constructor(public page: Page) {}

  async open() {
    await this.page.goto("/");
    await this.page.waitForSelector("select", { timeout: 10000 });
  }

  async login(email: string) {
    await login(this.page, email);
  }

  async sidebar(label: string) {
    await clickSidebar(this.page, label);
  }

  async search(id: string) {
    const input = this.page.locator('input[placeholder*="Search"], input[placeholder*="Declaration"]');
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.fill(id);
      await this.page.waitForTimeout(400);
    }
  }

  async clickReviewFor(id: string) {
    await this.search(id);
    await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  }

  async pickDecision(label: string) {
    await this.page
      .locator(`label:has-text("${label}")`)
      .first()
      .click();
    await this.page.waitForTimeout(300);
  }

  async submitDecision() {
    await this.page.click('button:has-text("Submit Decision")');
    await this.page.getByText("Decision submitted", { timeout: 10000 }).waitFor();
  }

  async verifyStatus(declarationId: string, status: string) {
    await this.sidebar("All Declarations");
    await this.page.getByRole("button", { name: "All", exact: true }).click();

    await this.search(declarationId);
    await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  }

  async assertVisible(selector: string, timeout = 10000) {
    await expect(this.page.locator(selector)).toBeVisible({ timeout });
  }
}

export class NewDeclarationPage {
  constructor(public page: Page) {}

  async open() {
    await this.page.click('button:has-text("New Declaration")');
  }

  async autoFilled(teamMember: string, manager: string) {
    await expect(this.page.locator('label:has-text("Team Member Name") + input')).toHaveValue(teamMember, { timeout: 10000 });
    await expect(this.page.locator('label:has-text("Manager Name") + input')).toHaveValue(manager, { timeout: 10000 });
  }

  async receivedGiven(option: string) {
    await this.page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
  }

  async select(label: string, option: string) {
    await this.page.locator(`div:has(> label:has-text("${label}")) [role="combobox"]`).click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
    await this.page.waitForTimeout(150);
  }

  async fill(label: string, value: string) {
    await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  }

  async textarea(value: string) {
    await this.page.locator("textarea").fill(value);
  }

  async date(value: string) {
    await this.page.locator('input[type="date"]').fill(value);
  }

  async number(label: string, value: string) {
    await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  }

  async submit() {
    await this.page.click('button:has-text("Submit Declaration")');
    await this.page.getByText("Declaration Submitted", { timeout: 15000 }).waitFor();
  }

  async getId(): Promise<string> {
    const text = await this.page.locator("span.font-mono.font-bold").textContent();
    return text?.trim() ?? "";
  }

  async closeModal() {
    const btn = this.page.getByRole("button", { name: "Close" });
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
    }
  }
}
