import { expect, type Page } from "@playwright/test";

export const USERS = {
  nomvula:  { email: "nomvula@hb.co.za",  role: "teamMember", name: "Nomvula Dlamini" },
  sipho:    { email: "sipho@hb.co.za",    role: "approver",   name: "Sipho Nkosi" },
  lindiwe:  { email: "lindiwe@hb.co.za",  role: "approver",   name: "Lindiwe Zulu" },
  admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
};

// Indices into the LandingScreen quick-login dropdown (must match its order).
export const LOGIN_INDEX: Record<string, number> = {
  "nomvula@hb.co.za": 0,
  "sipho@hb.co.za": 1,
  "lindiwe@hb.co.za": 4,
  "admin@hb.co.za": 6,
};

export async function login(page: Page, email: string) {
  await page.goto("/");
  await page.waitForSelector("select", { timeout: 10000 });
  await page.selectOption("select", String(LOGIN_INDEX[email]));
  await page.click('button[type="submit"]');
  // Desktop renders the sidebar inside <aside>; mobile renders the compact
  // navigation as a top-level <nav>.
  // Logins are rate-limited (429) per IP: on a still-landing page, back off
  // across the 60s window and resubmit.
  let lastError: unknown = null;
  for (const waitMs of [0, 6000, 30000, 65000]) {
    if (waitMs > 0) await page.waitForTimeout(waitMs);
    try {
      await page.waitForSelector("aside nav, nav", { timeout: 15000 });
      return;
    } catch (e) {
      lastError = e;
      if (await page.locator("aside nav, nav").count() > 0) return;
      await page.click('button[type="submit"]').catch(() => undefined);
    }
  }
  throw lastError;
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
    // List screens always render a search box — wait for it instead of
    // silently skipping, so a missing box fails loudly at the right step.
    const input = this.page.locator('input[placeholder*="ID,"]');
    await input.first().waitFor({ state: "visible", timeout: 10000 });
    await input.first().fill(id);
    await this.page.waitForTimeout(400);
  }

  async clickReviewFor(id: string) {
    await this.search(id);
    await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  }

  async clickEditResubmitFor(id: string) {
    await this.search(id);
    await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Edit & Resubmit')`).first().click();
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
    // Filters default to All on page load; just search and assert.
    await this.search(declarationId);
    await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
    await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  }

  async assertVisible(selector: string, timeout: number | { timeout: number } = 10000) {
    const ms = typeof timeout === "number" ? timeout : timeout.timeout;
    await expect(this.page.locator(selector)).toBeVisible({ timeout: ms });
  }
}

export class NewDeclarationPage {
  constructor(public page: Page) {}

  async open() {
    await this.page.click('button:has-text("New Declaration")');
  }

  async autoFilled(teamMember: string, manager: string) {
    // Identity fields are read-only for team members (profile locking) and
    // wrapped in a div for other roles — match the input inside the field
    // container either way.
    await expect(this.page.locator('div:has(> label:has-text("Team Member Name")) input')).toHaveValue(teamMember, { timeout: 10000 });
    await expect(this.page.locator('div:has(> label:has-text("Manager Name")) input')).toHaveValue(manager, { timeout: 10000 });
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

  async substantiation(value: string) {
    await this.page.locator('textarea[placeholder*="Substantiation"]').fill(value);
  }

  async date(value: string) {
    await this.page.locator('input[type="date"]').fill(value);
  }

  async number(label: string, value: string) {
    await this.page.locator(`div:has(> label:has-text("${label}")) input`).fill(value);
  }

  async submit() {
    await this.page.click('button:has-text("Submit Declaration")');
    await this.page.getByText("Declaration Submitted", { timeout: 15000 }).waitFor();
  }

  /** Draft-edit flows populate the form asynchronously — wait for the saved
      description before submitting so validation sees draft values. */
  async waitForDraftDescription(text: string) {
    await expect(this.page.locator("textarea").first()).toHaveValue(new RegExp(text), { timeout: 10000 });
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
