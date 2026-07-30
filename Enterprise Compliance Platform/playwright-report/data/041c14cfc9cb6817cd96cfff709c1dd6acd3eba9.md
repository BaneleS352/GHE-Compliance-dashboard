# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Full approval: LM → HR → CEO (high-value)
- Location: e2e\approval-flows.spec.ts:11:3

# Error details

```
TimeoutError: page.goto: Timeout 20000ms exceeded.
Call log:
  - navigating to "http://localhost:5173/", waiting until "load"

```

# Test source

```ts
  1   | export const USERS = {
  2   |   nomvula:  { email: "nomvula@hb.co.za",  role: "teamMember", name: "Nomvula Dlamini" },
  3   |   sipho:    { email: "sipho@hb.co.za",    role: "approver",   name: "Sipho Nkosi" },
  4   |   lindiwe:  { email: "lindiwe@hb.co.za",  role: "approver",   name: "Lindiwe Zulu" },
  5   |   sandile:  { email: "sandile@hb.co.za",  role: "approver",   name: "Sandile Shabalala" },
  6   |   admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
  7   | };
  8   | 
  9   | export const LOGIN_INDEX: Record<string, number> = {
  10  |   "nomvula@hb.co.za": 0,
  11  |   "sipho@hb.co.za": 1,
  12  |   "lindiwe@hb.co.za": 2,
  13  |   "sandile@hb.co.za": 3,
  14  |   "admin@hb.co.za": 4,
  15  | };
  16  | 
  17  | export async function login(page: Page, email: string) {
> 18  |   await page.goto("/");
      |              ^ TimeoutError: page.goto: Timeout 20000ms exceeded.
  19  |   await page.waitForSelector("select", { timeout: 10000 });
  20  |   await page.selectOption("select", String(LOGIN_INDEX[email]));
  21  |   await page.click('button[type="submit"]');
  22  |   await page.waitForLoadState("networkidle");
  23  | }
  24  | 
  25  | export async function clickSidebar(page: Page, label: string) {
  26  |   await page.locator(`aside nav button:has-text("${label}")`).click();
  27  |   await page.waitForLoadState("networkidle");
  28  | }
  29  | 
  30  | export class AppPage {
  31  |   constructor(public page: Page) {}
  32  | 
  33  |   async open() {
  34  |     await this.page.goto("/");
  35  |     await this.page.waitForSelector("select", { timeout: 10000 });
  36  |   }
  37  | 
  38  |   async login(email: string) {
  39  |     await login(this.page, email);
  40  |   }
  41  | 
  42  |   async sidebar(label: string) {
  43  |     await clickSidebar(this.page, label);
  44  |   }
  45  | 
  46  |   async search(id: string) {
  47  |     const input = this.page.locator('input[placeholder*="Search"], input[placeholder*="Declaration"]');
  48  |     if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
  49  |       await input.fill(id);
  50  |       await this.page.waitForTimeout(400);
  51  |     }
  52  |   }
  53  | 
  54  |   async clickReviewFor(id: string) {
  55  |     await this.search(id);
  56  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  57  |     await this.page.waitForLoadState("networkidle");
  58  |   }
  59  | 
  60  |   async pickDecision(label: string) {
  61  |     await this.page
  62  |       .locator(`label:has-text("${label}")`)
  63  |       .first()
  64  |       .click();
  65  |     await this.page.waitForTimeout(300);
  66  |   }
  67  | 
  68  |   async submitDecision() {
  69  |     await this.page.click('button:has-text("Submit Decision")');
  70  |     await this.page.getByText("Decision submitted", { timeout: 10000 }).waitFor();
  71  |   }
  72  | 
  73  |   async verifyStatus(declarationId: string, status: string) {
  74  |     await this.sidebar("All Declarations");
  75  |     await this.page.getByRole("button", { name: "All", exact: true }).click();
  76  |     await this.page.waitForLoadState("networkidle");
  77  | 
  78  |     await this.search(declarationId);
  79  |     await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
  80  |     await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  81  |   }
  82  | 
  83  |   async assertVisible(selector: string, timeout = 10000) {
  84  |     await expect(this.page.locator(selector)).toBeVisible({ timeout });
  85  |   }
  86  | }
  87  | 
  88  | export class NewDeclarationPage {
  89  |   constructor(public page: Page) {}
  90  | 
  91  |   async open() {
  92  |     await this.page.click('button:has-text("New Declaration")');
  93  |     await this.page.waitForLoadState("networkidle");
  94  |   }
  95  | 
  96  |   async autoFilled(teamMember: string, manager: string) {
  97  |     await expect(this.page.locator('label:has-text("Team Member Name") + input')).toHaveValue(teamMember, { timeout: 10000 });
  98  |     await expect(this.page.locator('label:has-text("Manager Name") + input')).toHaveValue(manager, { timeout: 10000 });
  99  |   }
  100 | 
  101 |   async receivedGiven(option: string) {
  102 |     await this.page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
  103 |     await this.page.getByRole("option", { name: option, exact: true }).click();
  104 |   }
  105 | 
  106 |   async select(label: string, option: string) {
  107 |     await this.page.locator(`div:has(> label:has-text("${label}")) [role="combobox"]`).click();
  108 |     await this.page.getByRole("option", { name: option, exact: true }).click();
  109 |     await this.page.waitForTimeout(150);
  110 |   }
  111 | 
  112 |   async fill(label: string, value: string) {
  113 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  114 |   }
  115 | 
  116 |   async textarea(value: string) {
  117 |     await this.page.locator("textarea").fill(value);
  118 |   }
```