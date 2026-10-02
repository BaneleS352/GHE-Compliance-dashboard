# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Team member views approved declaration timeline
- Location: e2e\approval-flows.spec.ts:93:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Completed')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Completed')

```

```yaml
- complementary:
  - img "Hollywoodbets"
  - button:
    - img
  - navigation:
    - paragraph: Team Member
    - button "New Declaration":
      - img
      - text: New Declaration
    - button "My Declarations":
      - img
      - text: My Declarations
- banner:
  - text: Gift, Hospitality or Entertainment ("GHE") Declaration System ND
  - paragraph: Nomvula Dlamini
  - paragraph: Team Member
  - button:
    - img
- main:
  - button "Back":
    - img
    - text: Back
  - text: GHE-2025-0011 Pending System thresholds could not be loaded — default values are shown.
  - heading "Declaration Details" [level=2]
  - paragraph: Company
  - paragraph: Hollywoodbets Group
  - paragraph: Department
  - paragraph: Marketing
  - paragraph: Approving Manager Name
  - paragraph: Sipho Nkosi
  - paragraph: Team Member
  - paragraph: Nomvula Dlamini
  - paragraph: Team Member Code
  - paragraph: HB-204478
  - paragraph: Team Member Role / Position
  - paragraph: Senior Brand Manager
  - paragraph: GHE Received/Given
  - paragraph: Received
  - paragraph: Category
  - paragraph: Gift
  - paragraph: Counter Party Type
  - paragraph: Supplier
  - paragraph: Counter Party
  - paragraph: Nike SA
  - paragraph: Name Of Counter Person
  - paragraph: Mike Brown
  - paragraph: Date
  - paragraph: 2025-06-14
  - paragraph: Value
  - paragraph: R 1 500
  - paragraph: Reason/Occasion
  - paragraph: Business Meeting
  - paragraph: Bid In Progress
  - paragraph: "No"
  - paragraph: Contract In Progress
  - paragraph: —
  - paragraph: Description
  - paragraph: Promotional merchandise received at a brand activation event
  - paragraph: Substantiation (> R1000)
  - paragraph: Required
  - img
  - heading "Approval Workflow" [level=1]
  - paragraph: 1. Line Manager Approval
  - paragraph: Line Manager
  - text: In Progress
  - paragraph:
    - text: Awaiting action from
    - strong: Line Manager
  - text: Date - Time -
  - paragraph: 2. Head of HR Approval
  - paragraph: Head of HR
  - text: Pending Date - Time -
  - heading "Supporting Documents" [level=3]
  - text: No supporting documents were uploaded for this declaration.
- region "Notifications alt+T"
```

# Test source

```ts
  1   | import { expect, type Page } from "@playwright/test";
  2   | 
  3   | export const USERS = {
  4   |   nomvula:  { email: "nomvula@hb.co.za",  role: "teamMember", name: "Nomvula Dlamini" },
  5   |   sipho:    { email: "sipho@hb.co.za",    role: "approver",   name: "Sipho Nkosi" },
  6   |   lindiwe:  { email: "lindiwe@hb.co.za",  role: "approver",   name: "Lindiwe Zulu" },
  7   |   admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
  8   | };
  9   | 
  10  | // Indices into the LandingScreen quick-login dropdown (must match its order).
  11  | export const LOGIN_INDEX: Record<string, number> = {
  12  |   "nomvula@hb.co.za": 0,
  13  |   "sipho@hb.co.za": 1,
  14  |   "lindiwe@hb.co.za": 4,
  15  |   "admin@hb.co.za": 6,
  16  | };
  17  | 
  18  | export async function login(page: Page, email: string) {
  19  |   await page.goto("/");
  20  |   await page.waitForSelector("select", { timeout: 10000 });
  21  |   await page.selectOption("select", String(LOGIN_INDEX[email]));
  22  |   await page.click('button[type="submit"]');
  23  |   // Desktop renders the sidebar inside <aside>; mobile renders the compact
  24  |   // navigation as a top-level <nav>.
  25  |   await page.waitForSelector("aside nav, nav", { timeout: 15000 });
  26  | }
  27  | 
  28  | export async function clickSidebar(page: Page, label: string) {
  29  |   await page.locator(`aside nav button:has-text("${label}"):visible, nav button:has-text("${label}"):visible`).first().click();
  30  | }
  31  | 
  32  | export class AppPage {
  33  |   constructor(public page: Page) {}
  34  | 
  35  |   async open() {
  36  |     await this.page.goto("/");
  37  |     await this.page.waitForSelector("select", { timeout: 10000 });
  38  |   }
  39  | 
  40  |   async login(email: string) {
  41  |     await login(this.page, email);
  42  |   }
  43  | 
  44  |   async sidebar(label: string) {
  45  |     await clickSidebar(this.page, label);
  46  |   }
  47  | 
  48  |   async search(id: string) {
  49  |     const input = this.page.locator('input[placeholder*="ID,"], input[placeholder*="Search"], input[placeholder*="Declaration"]');
  50  |     if (await input.first().isVisible({ timeout: 3000 }).catch(() => false)) {
  51  |       await input.first().fill(id);
  52  |       await this.page.waitForTimeout(400);
  53  |     }
  54  |   }
  55  | 
  56  |   async clickReviewFor(id: string) {
  57  |     await this.search(id);
  58  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  59  |   }
  60  | 
  61  |   async pickDecision(label: string) {
  62  |     await this.page
  63  |       .locator(`label:has-text("${label}")`)
  64  |       .first()
  65  |       .click();
  66  |     await this.page.waitForTimeout(300);
  67  |   }
  68  | 
  69  |   async submitDecision() {
  70  |     await this.page.click('button:has-text("Submit Decision")');
  71  |     await this.page.getByText("Decision submitted", { timeout: 10000 }).waitFor();
  72  |   }
  73  | 
  74  |   async verifyStatus(declarationId: string, status: string) {
  75  |     await this.sidebar("All Declarations");
  76  |     // Filters default to All on page load; just search and assert.
  77  |     await this.search(declarationId);
  78  |     await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
  79  |     await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  80  |   }
  81  | 
  82  |   async assertVisible(selector: string, timeout: number | { timeout: number } = 10000) {
  83  |     const ms = typeof timeout === "number" ? timeout : timeout.timeout;
> 84  |     await expect(this.page.locator(selector)).toBeVisible({ timeout: ms });
      |                                               ^ Error: expect(locator).toBeVisible() failed
  85  |   }
  86  | }
  87  | 
  88  | export class NewDeclarationPage {
  89  |   constructor(public page: Page) {}
  90  | 
  91  |   async open() {
  92  |     await this.page.click('button:has-text("New Declaration")');
  93  |   }
  94  | 
  95  |   async autoFilled(teamMember: string, manager: string) {
  96  |     // Identity fields are read-only for team members (profile locking) and
  97  |     // wrapped in a div for other roles — match the input inside the field
  98  |     // container either way.
  99  |     await expect(this.page.locator('div:has(> label:has-text("Team Member Name")) input')).toHaveValue(teamMember, { timeout: 10000 });
  100 |     await expect(this.page.locator('div:has(> label:has-text("Manager Name")) input')).toHaveValue(manager, { timeout: 10000 });
  101 |   }
  102 | 
  103 |   async receivedGiven(option: string) {
  104 |     await this.page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
  105 |     await this.page.getByRole("option", { name: option, exact: true }).click();
  106 |   }
  107 | 
  108 |   async select(label: string, option: string) {
  109 |     await this.page.locator(`div:has(> label:has-text("${label}")) [role="combobox"]`).click();
  110 |     await this.page.getByRole("option", { name: option, exact: true }).click();
  111 |     await this.page.waitForTimeout(150);
  112 |   }
  113 | 
  114 |   async fill(label: string, value: string) {
  115 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  116 |   }
  117 | 
  118 |   async textarea(value: string) {
  119 |     await this.page.locator("textarea").fill(value);
  120 |   }
  121 | 
  122 |   async date(value: string) {
  123 |     await this.page.locator('input[type="date"]').fill(value);
  124 |   }
  125 | 
  126 |   async number(label: string, value: string) {
  127 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  128 |   }
  129 | 
  130 |   async submit() {
  131 |     await this.page.click('button:has-text("Submit Declaration")');
  132 |     await this.page.getByText("Declaration Submitted", { timeout: 15000 }).waitFor();
  133 |   }
  134 | 
  135 |   async getId(): Promise<string> {
  136 |     const text = await this.page.locator("span.font-mono.font-bold").textContent();
  137 |     return text?.trim() ?? "";
  138 |   }
  139 | 
  140 |   async closeModal() {
  141 |     const btn = this.page.getByRole("button", { name: "Close" });
  142 |     if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
  143 |       await btn.click();
  144 |     }
  145 |   }
  146 | }
  147 | 
```