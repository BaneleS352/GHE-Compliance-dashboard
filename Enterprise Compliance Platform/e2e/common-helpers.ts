import { expect, type Page } from "@playwright/test";

export const USERS = {
  nomvula:  { email: "nomvula@hb.co.za",  role: "teamMember", name: "Nomvula Dlamini" },
  sipho:    { email: "sipho@hb.co.za",    role: "approver",   name: "Sipho Nkosi" },
  lindiwe:  { email: "lindiwe@hb.co.za",  role: "approver",   name: "Lindiwe Zulu" },
  admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
};

// Test identity minting (OpenID Phase 5 seam): the Playwright global setup
// boots a throwaway JWKS provider; specs mint per-user RS256 tokens from it
// and inject them into `sessionStorage`, where the DEV-only hook in
// `src/app/auth/msal.ts` picks them up. No UI login, no passwords, no
// production footprint (the hook is tree-shaken out of production builds).
const JWKS_BASE = process.env.E2E_JWKS_URL || "http://127.0.0.1:55439";

export async function login(page: Page, email: string) {
  const user = Object.values(USERS).find((u) => u.email === email);
  const mint = await fetch(`${JWKS_BASE}/test-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, name: user?.name ?? email, oid: `test-oid-e2e-${email}` }),
  });
  if (!mint.ok) throw new Error(`test identity minting failed: ${mint.status}`);
  const token = await mint.text();
  await page.addInitScript((t) => sessionStorage.setItem("e2e.auth.token", t), token);
  await page.goto("/");
  // Desktop renders the sidebar inside <aside>; mobile renders the compact
  // navigation as a top-level <nav>. The hidden breakpoint twin is always
  // present in the DOM, so qualify with :visible — a bare waitForSelector
  // latches onto the first DOM match (the hidden desktop nav on mobile)
  // and times out even though the mobile nav is showing.
  await page.locator("aside nav:visible, nav:visible").first().waitFor({ timeout: 15000 });
}

export async function clickSidebar(page: Page, label: string) {
  await page.locator(`aside nav button:has-text("${label}"):visible, nav button:has-text("${label}"):visible`).first().click();
}

export class AppPage {
  constructor(public page: Page) {}

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
