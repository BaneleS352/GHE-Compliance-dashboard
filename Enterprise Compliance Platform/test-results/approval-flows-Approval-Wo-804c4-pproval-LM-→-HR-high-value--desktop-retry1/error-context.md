# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Full approval: LM → HR (high-value)
- Location: e2e\approval-flows.spec.ts:11:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('table tr:has(td:has-text("GHE-2024-0047")) button:has-text(\'Review\')').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - complementary [ref=e4]:
      - generic [ref=e5]:
        - img "Hollywoodbets" [ref=e7]
        - button [ref=e8]:
          - img [ref=e9]
      - navigation [ref=e11]:
        - paragraph [ref=e12]: Approver
        - generic [ref=e13]:
          - button "Dashboard" [ref=e14]:
            - img [ref=e15]
            - text: Dashboard
          - button "New Declaration" [ref=e18]:
            - img [ref=e19]
            - text: New Declaration
          - button "Approval Queue" [active] [ref=e23]:
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
              - heading "Approval Queue" [level=1] [ref=e53]
              - paragraph [ref=e54]: 8 actionable approvals awaiting your review
            - generic [ref=e56]:
              - button "Clear Filters" [ref=e57]
              - button "Export Excel" [ref=e58]:
                - img [ref=e59]
                - text: Export Excel
          - generic [ref=e62]: SLA configuration could not be loaded — overdue highlighting uses a 3-day default.
          - generic [ref=e63]:
            - generic [ref=e64]:
              - generic [ref=e65]: Search
              - generic [ref=e66]:
                - img [ref=e67]
                - textbox "ID, Employee or Counterparty" [ref=e70]
            - generic [ref=e71]:
              - generic [ref=e72]: Department
              - combobox [ref=e74] [cursor=pointer]:
                - option "All Departments" [selected]
                - option "Finance"
                - option "HR"
                - option "IT"
                - option "Marketing"
                - option "Operations"
                - option "Sales"
            - generic [ref=e75]:
              - generic [ref=e76]: Employee
              - combobox [ref=e78] [cursor=pointer]:
                - option "All Employees" [selected]
                - option "Ayanda Khumalo"
                - option "Bongani Cele"
                - option "Lindiwe Zulu"
                - option "Nomvula Dlamini"
                - option "Pieter van der Berg"
                - option "Thabo Mokoena"
            - generic [ref=e79]:
              - generic [ref=e80]: Status
              - combobox [ref=e82] [cursor=pointer]:
                - option "All Statuses" [selected]
                - option "Pending"
                - option "Escalated"
                - option "Returned"
            - generic [ref=e83]:
              - generic [ref=e84]: Priority
              - combobox [ref=e86] [cursor=pointer]:
                - option "All Priorities" [selected]
                - option "High"
                - option "Medium"
                - option "Low"
            - button "Overdue only" [ref=e88]:
              - img [ref=e89]
              - text: Overdue only
          - generic [ref=e91]:
            - table [ref=e92]:
              - rowgroup [ref=e93]:
                - row "Declaration ID TeamMember Dept Type Counterparty Value Submitted Priority Status Step Actions" [ref=e94]:
                  - columnheader "Declaration ID" [ref=e95] [cursor=pointer]
                  - columnheader "TeamMember" [ref=e96] [cursor=pointer]
                  - columnheader "Dept" [ref=e97] [cursor=pointer]
                  - columnheader "Type" [ref=e98] [cursor=pointer]
                  - columnheader "Counterparty" [ref=e99] [cursor=pointer]
                  - columnheader "Value" [ref=e100] [cursor=pointer]
                  - columnheader "Submitted" [ref=e101] [cursor=pointer]
                  - columnheader "Priority" [ref=e102] [cursor=pointer]
                  - columnheader "Status" [ref=e103] [cursor=pointer]
                  - columnheader "Step" [ref=e104] [cursor=pointer]
                  - columnheader "Actions" [ref=e105]
              - rowgroup [ref=e106]:
                - row "GHE-2024-0045 Ayanda Khumalo Operations Entertainment Emirates Airline R 34 000 2024-11-08 High Pending Line Manager Review Review" [ref=e107]:
                  - cell "GHE-2024-0045" [ref=e108]
                  - cell "Ayanda Khumalo" [ref=e109]
                  - cell "Operations" [ref=e110]
                  - cell "Entertainment" [ref=e111]
                  - cell "Emirates Airline" [ref=e112]
                  - cell "R 34 000" [ref=e113]
                  - cell "2024-11-08" [ref=e114]
                  - cell "High" [ref=e115]
                  - cell "Pending" [ref=e116]:
                    - generic [ref=e117]: Pending
                  - cell "Line Manager Review" [ref=e119]
                  - cell "Review" [ref=e120]:
                    - button "Review" [ref=e121]
                - row "GHE-2024-0044 Pieter van der Berg Finance Hospitality La Colombe Restaurant R 3 200 2024-11-06 Medium Pending Line Manager Review Review" [ref=e122]:
                  - cell "GHE-2024-0044" [ref=e123]
                  - cell "Pieter van der Berg" [ref=e124]
                  - cell "Finance" [ref=e125]
                  - cell "Hospitality" [ref=e126]
                  - cell "La Colombe Restaurant" [ref=e127]
                  - cell "R 3 200" [ref=e128]
                  - cell "2024-11-06" [ref=e129]
                  - cell "Medium" [ref=e130]
                  - cell "Pending" [ref=e131]:
                    - generic [ref=e132]: Pending
                  - cell "Line Manager Review" [ref=e134]
                  - cell "Review" [ref=e135]:
                    - button "Review" [ref=e136]
                - row "GHE-2024-0042 Bongani Cele IT Entertainment Sun International R 12 800 2024-11-02 Medium Pending Line Manager Review Review" [ref=e137]:
                  - cell "GHE-2024-0042" [ref=e138]
                  - cell "Bongani Cele" [ref=e139]
                  - cell "IT" [ref=e140]
                  - cell "Entertainment" [ref=e141]
                  - cell "Sun International" [ref=e142]
                  - cell "R 12 800" [ref=e143]
                  - cell "2024-11-02" [ref=e144]
                  - cell "Medium" [ref=e145]
                  - cell "Pending" [ref=e146]:
                    - generic [ref=e147]: Pending
                  - cell "Line Manager Review" [ref=e149]
                  - cell "Review" [ref=e150]:
                    - button "Review" [ref=e151]
                - row "GHE-2025-0011 Nomvula Dlamini Marketing Gift Nike SA R 1 500 2025-06-15 Low Pending Line Manager Review Review" [ref=e152]:
                  - cell "GHE-2025-0011" [ref=e153]
                  - cell "Nomvula Dlamini" [ref=e154]
                  - cell "Marketing" [ref=e155]
                  - cell "Gift" [ref=e156]
                  - cell "Nike SA" [ref=e157]
                  - cell "R 1 500" [ref=e158]
                  - cell "2025-06-15" [ref=e159]
                  - cell "Low" [ref=e160]
                  - cell "Pending" [ref=e161]:
                    - generic [ref=e162]: Pending
                  - cell "Line Manager Review" [ref=e164]
                  - cell "Review" [ref=e165]:
                    - button "Review" [ref=e166]
                - row "GHE-2025-0010 Thabo Mokoena Sales Entertainment Vodacom SA R 4 500 2025-06-12 Medium Pending Line Manager Review Review" [ref=e167]:
                  - cell "GHE-2025-0010" [ref=e168]
                  - cell "Thabo Mokoena" [ref=e169]
                  - cell "Sales" [ref=e170]
                  - cell "Entertainment" [ref=e171]
                  - cell "Vodacom SA" [ref=e172]
                  - cell "R 4 500" [ref=e173]
                  - cell "2025-06-12" [ref=e174]
                  - cell "Medium" [ref=e175]
                  - cell "Pending" [ref=e176]:
                    - generic [ref=e177]: Pending
                  - cell "Line Manager Review" [ref=e179]
                  - cell "Review" [ref=e180]:
                    - button "Review" [ref=e181]
                - row "GHE-2025-0008 Ayanda Khumalo Operations Gift Deloitte SA R 800 2025-06-05 Low Pending Line Manager Review Review" [ref=e182]:
                  - cell "GHE-2025-0008" [ref=e183]
                  - cell "Ayanda Khumalo" [ref=e184]
                  - cell "Operations" [ref=e185]
                  - cell "Gift" [ref=e186]
                  - cell "Deloitte SA" [ref=e187]
                  - cell "R 800" [ref=e188]
                  - cell "2025-06-05" [ref=e189]
                  - cell "Low" [ref=e190]
                  - cell "Pending" [ref=e191]:
                    - generic [ref=e192]: Pending
                  - cell "Line Manager Review" [ref=e194]
                  - cell "Review" [ref=e195]:
                    - button "Review" [ref=e196]
                - row "GHE-2025-0007 Pieter van der Berg Finance Hospitality Standard Bank R 3 800 2025-06-01 Medium Pending Line Manager Review Review" [ref=e197]:
                  - cell "GHE-2025-0007" [ref=e198]
                  - cell "Pieter van der Berg" [ref=e199]
                  - cell "Finance" [ref=e200]
                  - cell "Hospitality" [ref=e201]
                  - cell "Standard Bank" [ref=e202]
                  - cell "R 3 800" [ref=e203]
                  - cell "2025-06-01" [ref=e204]
                  - cell "Medium" [ref=e205]
                  - cell "Pending" [ref=e206]:
                    - generic [ref=e207]: Pending
                  - cell "Line Manager Review" [ref=e209]
                  - cell "Review" [ref=e210]:
                    - button "Review" [ref=e211]
                - row "GHE-2025-0020 Lindiwe Zulu HR Hospitality The Campus Honeydew R 1 800 2025-06-18 Low Pending Line Manager Review Review" [ref=e212]:
                  - cell "GHE-2025-0020" [ref=e213]
                  - cell "Lindiwe Zulu" [ref=e214]
                  - cell "HR" [ref=e215]
                  - cell "Hospitality" [ref=e216]
                  - cell "The Campus Honeydew" [ref=e217]
                  - cell "R 1 800" [ref=e218]
                  - cell "2025-06-18" [ref=e219]
                  - cell "Low" [ref=e220]
                  - cell "Pending" [ref=e221]:
                    - generic [ref=e222]: Pending
                  - cell "Line Manager Review" [ref=e224]
                  - cell "Review" [ref=e225]:
                    - button "Review" [ref=e226]
            - paragraph [ref=e228]: Showing 8 declarations
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
> 58  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
      |                                                                                                     ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  84  |     await expect(this.page.locator(selector)).toBeVisible({ timeout: ms });
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