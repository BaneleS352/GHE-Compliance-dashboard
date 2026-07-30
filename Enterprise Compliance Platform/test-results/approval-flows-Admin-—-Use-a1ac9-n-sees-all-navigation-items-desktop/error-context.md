# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Admin — User Management >> Admin sees all navigation items
- Location: e2e\approval-flows.spec.ts:209:3

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
      - paragraph [ref=e12]: Administrator
      - generic [ref=e13]:
        - button "Dashboard" [active] [ref=e14]:
          - img [ref=e15]
          - text: Dashboard
        - button "Users" [ref=e18]:
          - img [ref=e19]
          - text: Users
        - button "Workflows" [ref=e24]:
          - img [ref=e25]
          - text: Workflows
        - button "Dropdowns" [ref=e27]:
          - img [ref=e28]
          - text: Dropdowns
        - button "Config" [ref=e29]:
          - img [ref=e30]
          - text: Config
        - button "Reports" [ref=e33]:
          - img [ref=e34]
          - text: Reports
        - button "Approval Options" [ref=e37]:
          - img [ref=e38]
          - text: Approval Options
  - generic [ref=e41]:
    - banner [ref=e42]:
      - generic [ref=e47]: Gift, Hospitality or Entertainment ("GHE") Declaration System
      - generic [ref=e48]:
        - generic [ref=e50]:
          - generic [ref=e51]: SA
          - generic [ref=e52]:
            - paragraph [ref=e53]: System Admin
            - paragraph [ref=e54]: Administrator
        - button [ref=e55]:
          - img [ref=e56]
    - main [ref=e59]:
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]:
            - heading "Admin Dashboard" [level=1] [ref=e63]
            - paragraph [ref=e64]: System Management Overview
          - button "Manage Users" [ref=e66]:
            - img [ref=e67]
            - text: Manage Users
        - generic [ref=e72]:
          - generic [ref=e74] [cursor=pointer]:
            - generic [ref=e75]:
              - img [ref=e77]
              - generic [ref=e82]: Total Users
            - generic [ref=e83]: "18"
          - generic [ref=e85] [cursor=pointer]:
            - generic [ref=e86]:
              - img [ref=e88]
              - generic [ref=e90]: Active Workflows
            - generic [ref=e91]: "3"
          - generic [ref=e93] [cursor=pointer]:
            - generic [ref=e94]:
              - img [ref=e96]
              - generic [ref=e99]: Declarations
            - generic [ref=e100]: "19"
          - generic [ref=e102]:
            - generic [ref=e103]:
              - img [ref=e105]
              - generic [ref=e107]: Value Threshold
            - generic [ref=e108]: R2000
        - generic [ref=e109]:
          - generic [ref=e110]:
            - generic [ref=e112]:
              - paragraph [ref=e113]: Quick Links
              - heading "Admin Tools" [level=3] [ref=e114]
            - generic [ref=e115]:
              - generic [ref=e116] [cursor=pointer]:
                - generic [ref=e117]:
                  - paragraph [ref=e118]: User Management
                  - paragraph [ref=e119]: Add, edit, or remove system users and roles.
                - button "Manage" [ref=e120]
              - generic [ref=e121] [cursor=pointer]:
                - generic [ref=e122]:
                  - paragraph [ref=e123]: Workflow Config
                  - paragraph [ref=e124]: Setup conditional routing and approver tiers.
                - button "Manage" [ref=e125]
              - generic [ref=e126] [cursor=pointer]:
                - generic [ref=e127]:
                  - paragraph [ref=e128]: Dropdown Data
                  - paragraph [ref=e129]: Manage categories, occasions, and departments.
                - button "Manage" [ref=e130]
              - generic [ref=e131] [cursor=pointer]:
                - generic [ref=e132]:
                  - paragraph [ref=e133]: System Config
                  - paragraph [ref=e134]: Update compliance thresholds and configuration.
                - button "Manage" [ref=e135]
          - generic [ref=e136]:
            - img [ref=e138]
            - heading "System Healthy" [level=3] [ref=e140]
            - paragraph [ref=e141]: All services are running normally. 18 users and 19 declarations in the system.
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