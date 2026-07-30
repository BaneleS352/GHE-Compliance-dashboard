# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Reports >> Admin accesses reports
- Location: e2e\approval-flows.spec.ts:237:3

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
        - button "Dashboard" [ref=e14]:
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
        - button "Reports" [active] [ref=e33]:
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
        - generic [ref=e62]:
          - heading "Operational Management Reports" [level=1] [ref=e63]
          - paragraph [ref=e64]: Generate and export focused operational reports.
        - generic [ref=e65]:
          - generic [ref=e66]:
            - button "High-Value Gifts Report" [ref=e67]
            - button "Counterparty Concentration Report" [ref=e68]
          - paragraph [ref=e69]: "|"
          - paragraph [ref=e70]: Employee-level summary for declarations valued at R2,000 and above in the selected period.
        - generic [ref=e73]:
          - button "Export Excel" [ref=e74]:
            - img [ref=e75]
            - text: Export Excel
          - button "Export PDF" [ref=e78]:
            - img [ref=e79]
            - text: Export PDF
        - generic [ref=e83]:
          - generic [ref=e84]:
            - generic [ref=e85]: Start Date
            - textbox [ref=e86]
          - generic [ref=e87]:
            - generic [ref=e88]: End Date
            - textbox [ref=e89]
          - generic [ref=e90]:
            - generic [ref=e91]: Department
            - combobox [ref=e92] [cursor=pointer]:
              - option "All Departments" [selected]
              - option "Executive"
              - option "Finance"
              - option "HR"
              - option "IT"
              - option "Legal"
              - option "Marketing"
              - option "Operations"
              - option "Sales"
          - generic [ref=e93]:
            - generic [ref=e94]: Status
            - combobox [ref=e95] [cursor=pointer]:
              - option "All Statuses" [selected]
              - option "Draft"
              - option "Pending"
              - option "Approved"
              - option "Declined"
              - option "Escalated"
              - option "Returned"
          - button "Generate Report" [ref=e97]:
            - img [ref=e98]
            - text: Generate Report
        - generic [ref=e102]:
          - generic [ref=e103]:
            - heading "High-Value Gifts Report" [level=3] [ref=e104]
            - generic [ref=e105]: Generated 2026/07/30, 07:59:35
          - table [ref=e106]:
            - rowgroup [ref=e107]:
              - row "Employee Line Manager Declarations Total Value Average Value Total G Total H Total E Most Frequent Supplier" [ref=e108]:
                - columnheader "Employee" [ref=e109]
                - columnheader "Line Manager" [ref=e110]
                - columnheader "Declarations" [ref=e111]
                - columnheader "Total Value" [ref=e112]
                - columnheader "Average Value" [ref=e113]
                - columnheader "Total G" [ref=e114]
                - columnheader "Total H" [ref=e115]
                - columnheader "Total E" [ref=e116]
                - columnheader "Most Frequent Supplier" [ref=e117]
            - rowgroup [ref=e118]:
              - row "Ayanda Khumalo R 0.00 R 0.00" [ref=e119]:
                - cell "Ayanda Khumalo" [ref=e120]
                - cell [ref=e121]
                - cell [ref=e122]
                - cell "R 0.00" [ref=e123]
                - cell "R 0.00" [ref=e124]
                - cell [ref=e125]
                - cell [ref=e126]
                - cell [ref=e127]
                - cell [ref=e128]
              - row "Nomvula Dlamini R 0.00 R 0.00" [ref=e129]:
                - cell "Nomvula Dlamini" [ref=e130]
                - cell [ref=e131]
                - cell [ref=e132]
                - cell "R 0.00" [ref=e133]
                - cell "R 0.00" [ref=e134]
                - cell [ref=e135]
                - cell [ref=e136]
                - cell [ref=e137]
                - cell [ref=e138]
              - row "Bongani Cele R 0.00 R 0.00" [ref=e139]:
                - cell "Bongani Cele" [ref=e140]
                - cell [ref=e141]
                - cell [ref=e142]
                - cell "R 0.00" [ref=e143]
                - cell "R 0.00" [ref=e144]
                - cell [ref=e145]
                - cell [ref=e146]
                - cell [ref=e147]
                - cell [ref=e148]
              - row "Sandile Shabalala R 0.00 R 0.00" [ref=e149]:
                - cell "Sandile Shabalala" [ref=e150]
                - cell [ref=e151]
                - cell [ref=e152]
                - cell "R 0.00" [ref=e153]
                - cell "R 0.00" [ref=e154]
                - cell [ref=e155]
                - cell [ref=e156]
                - cell [ref=e157]
                - cell [ref=e158]
              - row "Nomvula Dlamini R 0.00 R 0.00" [ref=e159]:
                - cell "Nomvula Dlamini" [ref=e160]
                - cell [ref=e161]
                - cell [ref=e162]
                - cell "R 0.00" [ref=e163]
                - cell "R 0.00" [ref=e164]
                - cell [ref=e165]
                - cell [ref=e166]
                - cell [ref=e167]
                - cell [ref=e168]
              - row "Siphamandla Ndlovu R 0.00 R 0.00" [ref=e169]:
                - cell "Siphamandla Ndlovu" [ref=e170]
                - cell [ref=e171]
                - cell [ref=e172]
                - cell "R 0.00" [ref=e173]
                - cell "R 0.00" [ref=e174]
                - cell [ref=e175]
                - cell [ref=e176]
                - cell [ref=e177]
                - cell [ref=e178]
              - row "Thabo Mokoena R 0.00 R 0.00" [ref=e179]:
                - cell "Thabo Mokoena" [ref=e180]
                - cell [ref=e181]
                - cell [ref=e182]
                - cell "R 0.00" [ref=e183]
                - cell "R 0.00" [ref=e184]
                - cell [ref=e185]
                - cell [ref=e186]
                - cell [ref=e187]
                - cell [ref=e188]
              - row "Pieter van der Berg R 0.00 R 0.00" [ref=e189]:
                - cell "Pieter van der Berg" [ref=e190]
                - cell [ref=e191]
                - cell [ref=e192]
                - cell "R 0.00" [ref=e193]
                - cell "R 0.00" [ref=e194]
                - cell [ref=e195]
                - cell [ref=e196]
                - cell [ref=e197]
                - cell [ref=e198]
              - row "Pieter van der Berg R 0.00 R 0.00" [ref=e199]:
                - cell "Pieter van der Berg" [ref=e200]
                - cell [ref=e201]
                - cell [ref=e202]
                - cell "R 0.00" [ref=e203]
                - cell "R 0.00" [ref=e204]
                - cell [ref=e205]
                - cell [ref=e206]
                - cell [ref=e207]
                - cell [ref=e208]
              - row "Nomvula Dlamini R 0.00 R 0.00" [ref=e209]:
                - cell "Nomvula Dlamini" [ref=e210]
                - cell [ref=e211]
                - cell [ref=e212]
                - cell "R 0.00" [ref=e213]
                - cell "R 0.00" [ref=e214]
                - cell [ref=e215]
                - cell [ref=e216]
                - cell [ref=e217]
                - cell [ref=e218]
              - row "Nomvula Dlamini R 0.00 R 0.00" [ref=e219]:
                - cell "Nomvula Dlamini" [ref=e220]
                - cell [ref=e221]
                - cell [ref=e222]
                - cell "R 0.00" [ref=e223]
                - cell "R 0.00" [ref=e224]
                - cell [ref=e225]
                - cell [ref=e226]
                - cell [ref=e227]
                - cell [ref=e228]
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