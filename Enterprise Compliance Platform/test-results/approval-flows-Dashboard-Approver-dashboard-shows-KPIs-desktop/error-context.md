# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Dashboard >> Approver dashboard shows KPIs
- Location: e2e\approval-flows.spec.ts:225:3

# Error details

```
ReferenceError: expect is not defined
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - img "Hollywoodbets" [ref=e7]
      - button [ref=e8]:
        - img [ref=e9]
    - navigation [ref=e11]:
      - paragraph [ref=e12]: Approver
      - generic [ref=e13]:
        - button "Dashboard" [active] [ref=e14]:
          - img [ref=e15]
          - text: Dashboard
        - button "New Declaration" [ref=e18]:
          - img [ref=e19]
          - text: New Declaration
        - button "Approval Queue" [ref=e23]:
          - img [ref=e24]
          - text: Approval Queue
        - button "All Declarations" [ref=e27]:
          - img [ref=e28]
          - text: All Declarations
  - generic [ref=e31]:
    - banner [ref=e32]:
      - generic [ref=e37]: Gift, Hospitality or Entertainment ("GHE") Declaration System
      - generic [ref=e38]:
        - generic [ref=e40]:
          - generic [ref=e41]: SN
          - generic [ref=e42]:
            - paragraph [ref=e43]: Sipho Nkosi
            - paragraph [ref=e44]: Approver
        - button [ref=e45]:
          - img [ref=e46]
    - main [ref=e49]:
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]:
            - heading "Approver Dashboard" [level=1] [ref=e53]
            - paragraph [ref=e54]: Current month view — July 2026
          - button "Approval Queue 0" [ref=e56]:
            - img [ref=e57]
            - text: Approval Queue
            - generic [ref=e60]: "0"
        - generic [ref=e61]:
          - generic [ref=e62] [cursor=pointer]:
            - generic [ref=e63]:
              - generic [ref=e64]:
                - img [ref=e66]
                - generic [ref=e69]: Pending Queue
              - generic [ref=e70]: "0"
            - img
          - generic [ref=e71] [cursor=pointer]:
            - generic [ref=e72]:
              - generic [ref=e73]:
                - img [ref=e75]
                - generic [ref=e77]: Approved
              - generic [ref=e78]: "0"
            - img
          - generic [ref=e79] [cursor=pointer]:
            - generic [ref=e80]:
              - generic [ref=e81]:
                - img [ref=e83]
                - generic [ref=e86]: Declined
              - generic [ref=e87]: "0"
            - img
          - generic [ref=e88] [cursor=pointer]:
            - generic [ref=e89]:
              - generic [ref=e90]:
                - img [ref=e92]
                - generic [ref=e94]: Escalated
              - generic [ref=e95]: "0"
            - img
          - generic [ref=e96]:
            - generic [ref=e97]:
              - generic [ref=e98]:
                - img [ref=e100]
                - generic [ref=e105]: Total Value
              - generic [ref=e106]: R 0
            - img
        - generic [ref=e107]:
          - generic [ref=e108]:
            - generic [ref=e109]:
              - img [ref=e110]
              - paragraph [ref=e113]: Team Member Activity
            - paragraph [ref=e115]: No current-month activity yet
          - generic [ref=e116]:
            - generic [ref=e117]:
              - img [ref=e118]
              - paragraph [ref=e123]: GHE Distribution
            - generic [ref=e125]: No current-month data yet
          - generic [ref=e126]:
            - generic [ref=e127]:
              - img [ref=e128]
              - paragraph [ref=e130]: Overdue 7+ Days
            - generic [ref=e132]:
              - paragraph [ref=e133]: All caught up!
              - paragraph [ref=e134]: No declarations overdue this month
        - generic [ref=e135]:
          - generic [ref=e136]:
            - heading "Department Insights" [level=3] [ref=e137]
            - paragraph [ref=e138]:
              - strong [ref=e139]: "0"
              - text: current-month declarations
          - table [ref=e141]:
            - rowgroup [ref=e142]:
              - row "Department Declarations Pending Approved Declined Total Value" [ref=e143]:
                - columnheader "Department" [ref=e144]
                - columnheader "Declarations" [ref=e145]
                - columnheader "Pending" [ref=e146]
                - columnheader "Approved" [ref=e147]
                - columnheader "Declined" [ref=e148]
                - columnheader "Total Value" [ref=e149]
            - rowgroup [ref=e150]:
              - row "No current-month data available" [ref=e151]:
                - cell "No current-month data available" [ref=e152]
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
  18  |   await page.goto("/");
  19  |   await page.waitForSelector("select", { timeout: 10000 });
  20  |   await page.selectOption("select", String(LOGIN_INDEX[email]));
  21  |   await page.click('button[type="submit"]');
  22  |   await page.waitForSelector("aside", { timeout: 15000 });
  23  | }
  24  | 
  25  | export async function clickSidebar(page: Page, label: string) {
  26  |   await page.locator(`aside nav button:has-text("${label}")`).click();
  27  | }
  28  | 
  29  | export class AppPage {
  30  |   constructor(public page: Page) {}
  31  | 
  32  |   async open() {
  33  |     await this.page.goto("/");
  34  |     await this.page.waitForSelector("select", { timeout: 10000 });
  35  |   }
  36  | 
  37  |   async login(email: string) {
  38  |     await login(this.page, email);
  39  |   }
  40  | 
  41  |   async sidebar(label: string) {
  42  |     await clickSidebar(this.page, label);
  43  |   }
  44  | 
  45  |   async search(id: string) {
  46  |     const input = this.page.locator('input[placeholder*="Search"], input[placeholder*="Declaration"]');
  47  |     if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
  48  |       await input.fill(id);
  49  |       await this.page.waitForTimeout(400);
  50  |     }
  51  |   }
  52  | 
  53  |   async clickReviewFor(id: string) {
  54  |     await this.search(id);
  55  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  56  |   }
  57  | 
  58  |   async pickDecision(label: string) {
  59  |     await this.page
  60  |       .locator(`label:has-text("${label}")`)
  61  |       .first()
  62  |       .click();
  63  |     await this.page.waitForTimeout(300);
  64  |   }
  65  | 
  66  |   async submitDecision() {
  67  |     await this.page.click('button:has-text("Submit Decision")');
  68  |     await this.page.getByText("Decision submitted", { timeout: 10000 }).waitFor();
  69  |   }
  70  | 
  71  |   async verifyStatus(declarationId: string, status: string) {
  72  |     await this.sidebar("All Declarations");
  73  |     await this.page.getByRole("button", { name: "All", exact: true }).click();
  74  | 
  75  |     await this.search(declarationId);
  76  |     await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
  77  |     await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  78  |   }
  79  | 
  80  |   async assertVisible(selector: string, timeout = 10000) {
> 81  |     await expect(this.page.locator(selector)).toBeVisible({ timeout });
      |     ^ ReferenceError: expect is not defined
  82  |   }
  83  | }
  84  | 
  85  | export class NewDeclarationPage {
  86  |   constructor(public page: Page) {}
  87  | 
  88  |   async open() {
  89  |     await this.page.click('button:has-text("New Declaration")');
  90  |   }
  91  | 
  92  |   async autoFilled(teamMember: string, manager: string) {
  93  |     await expect(this.page.locator('label:has-text("Team Member Name") + input')).toHaveValue(teamMember, { timeout: 10000 });
  94  |     await expect(this.page.locator('label:has-text("Manager Name") + input')).toHaveValue(manager, { timeout: 10000 });
  95  |   }
  96  | 
  97  |   async receivedGiven(option: string) {
  98  |     await this.page.locator('div:has(> label:has-text("Did you receive or give")) [role="combobox"]').click();
  99  |     await this.page.getByRole("option", { name: option, exact: true }).click();
  100 |   }
  101 | 
  102 |   async select(label: string, option: string) {
  103 |     await this.page.locator(`div:has(> label:has-text("${label}")) [role="combobox"]`).click();
  104 |     await this.page.getByRole("option", { name: option, exact: true }).click();
  105 |     await this.page.waitForTimeout(150);
  106 |   }
  107 | 
  108 |   async fill(label: string, value: string) {
  109 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  110 |   }
  111 | 
  112 |   async textarea(value: string) {
  113 |     await this.page.locator("textarea").fill(value);
  114 |   }
  115 | 
  116 |   async date(value: string) {
  117 |     await this.page.locator('input[type="date"]').fill(value);
  118 |   }
  119 | 
  120 |   async number(label: string, value: string) {
  121 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  122 |   }
  123 | 
  124 |   async submit() {
  125 |     await this.page.click('button:has-text("Submit Declaration")');
  126 |     await this.page.getByText("Declaration Submitted", { timeout: 15000 }).waitFor();
  127 |   }
  128 | 
  129 |   async getId(): Promise<string> {
  130 |     const text = await this.page.locator("span.font-mono.font-bold").textContent();
  131 |     return text?.trim() ?? "";
  132 |   }
  133 | 
  134 |   async closeModal() {
  135 |     const btn = this.page.getByRole("button", { name: "Close" });
  136 |     if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
  137 |       await btn.click();
  138 |     }
  139 |   }
  140 | }
```