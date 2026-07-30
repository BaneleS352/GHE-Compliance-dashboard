# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Full approval: LM → HR → CEO (high-value)
- Location: e2e\approval-flows.spec.ts:11:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('table tr:has(td:has-text("GHE-2024-0047")) button:has-text(\'Review\')').first()

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
            - paragraph [ref=e54]: 11 declarations awaiting your review
          - generic [ref=e56]:
            - button "Clear Filters" [ref=e57]
            - button "Export Excel" [ref=e58]:
              - img [ref=e59]
              - text: Export Excel
        - generic [ref=e62]:
          - generic [ref=e63]:
            - generic [ref=e64]: Search
            - generic [ref=e65]:
              - img [ref=e66]
              - textbox "ID, Employee or Counterparty" [ref=e69]
          - generic [ref=e70]:
            - generic [ref=e71]: Department
            - combobox [ref=e73] [cursor=pointer]:
              - option "All Departments" [selected]
              - option "Executive"
              - option "Finance"
              - option "HR"
              - option "IT"
              - option "Marketing"
              - option "Operations"
              - option "Sales"
          - generic [ref=e74]:
            - generic [ref=e75]: Employee
            - combobox [ref=e77] [cursor=pointer]:
              - option "All Employees" [selected]
              - option "Ayanda Khumalo"
              - option "Bongani Cele"
              - option "Lindiwe Zulu"
              - option "Nomvula Dlamini"
              - option "Pieter van der Berg"
              - option "Sandile Shabalala"
              - option "Thabo Mokoena"
          - generic [ref=e78]:
            - generic [ref=e79]: Status
            - combobox [ref=e81] [cursor=pointer]:
              - option "All Statuses" [selected]
              - option "Pending"
              - option "Escalated"
              - option "Returned"
          - generic [ref=e82]:
            - generic [ref=e83]: Priority
            - combobox [ref=e85] [cursor=pointer]:
              - option "All Priorities" [selected]
              - option "High"
              - option "Medium"
              - option "Low"
          - button "Overdue only" [ref=e87]:
            - img [ref=e88]
            - text: Overdue only
        - generic [ref=e90]:
          - table [ref=e91]:
            - rowgroup [ref=e92]:
              - row "Declaration ID Employee Dept Type Counterparty Value Submitted Priority Status Step Actions" [ref=e93]:
                - columnheader "Declaration ID" [ref=e94] [cursor=pointer]
                - columnheader "Employee" [ref=e95] [cursor=pointer]
                - columnheader "Dept" [ref=e96] [cursor=pointer]
                - columnheader "Type" [ref=e97] [cursor=pointer]
                - columnheader "Counterparty" [ref=e98] [cursor=pointer]
                - columnheader "Value" [ref=e99] [cursor=pointer]
                - columnheader "Submitted" [ref=e100] [cursor=pointer]
                - columnheader "Priority" [ref=e101] [cursor=pointer]
                - columnheader "Status" [ref=e102] [cursor=pointer]
                - columnheader "Step" [ref=e103] [cursor=pointer]
                - columnheader "Actions" [ref=e104]
            - rowgroup [ref=e105]:
              - row "GHE-2024-0045 Ayanda Khumalo Operations Entertainment Emirates Airline R 34 000 2024-11-08 High Pending Line Manager Review Review" [ref=e106]:
                - cell "GHE-2024-0045" [ref=e107]
                - cell "Ayanda Khumalo" [ref=e108]
                - cell "Operations" [ref=e109]
                - cell "Entertainment" [ref=e110]
                - cell "Emirates Airline" [ref=e111]
                - cell "R 34 000" [ref=e112]
                - cell "2024-11-08" [ref=e113]
                - cell "High" [ref=e114]
                - cell "Pending" [ref=e115]:
                  - generic [ref=e116]: Pending
                - cell "Line Manager Review" [ref=e118]
                - cell "Review" [ref=e119]:
                  - button "Review" [ref=e120]
              - row "GHE-2024-0044 Pieter van der Berg Finance Hospitality La Colombe Restaurant R 3 200 2024-11-06 Medium Pending Line Manager Review Review" [ref=e121]:
                - cell "GHE-2024-0044" [ref=e122]
                - cell "Pieter van der Berg" [ref=e123]
                - cell "Finance" [ref=e124]
                - cell "Hospitality" [ref=e125]
                - cell "La Colombe Restaurant" [ref=e126]
                - cell "R 3 200" [ref=e127]
                - cell "2024-11-06" [ref=e128]
                - cell "Medium" [ref=e129]
                - cell "Pending" [ref=e130]:
                  - generic [ref=e131]: Pending
                - cell "Line Manager Review" [ref=e133]
                - cell "Review" [ref=e134]:
                  - button "Review" [ref=e135]
              - row "GHE-2024-0042 Bongani Cele IT Entertainment Sun International R 12 800 2024-11-02 Medium Pending Line Manager Review Review" [ref=e136]:
                - cell "GHE-2024-0042" [ref=e137]
                - cell "Bongani Cele" [ref=e138]
                - cell "IT" [ref=e139]
                - cell "Entertainment" [ref=e140]
                - cell "Sun International" [ref=e141]
                - cell "R 12 800" [ref=e142]
                - cell "2024-11-02" [ref=e143]
                - cell "Medium" [ref=e144]
                - cell "Pending" [ref=e145]:
                  - generic [ref=e146]: Pending
                - cell "Line Manager Review" [ref=e148]
                - cell "Review" [ref=e149]:
                  - button "Review" [ref=e150]
              - row "GHE-2025-0011 Nomvula Dlamini Marketing Gift Nike SA R 1 500 2025-06-15 Low Pending Line Manager Review Review" [ref=e151]:
                - cell "GHE-2025-0011" [ref=e152]
                - cell "Nomvula Dlamini" [ref=e153]
                - cell "Marketing" [ref=e154]
                - cell "Gift" [ref=e155]
                - cell "Nike SA" [ref=e156]
                - cell "R 1 500" [ref=e157]
                - cell "2025-06-15" [ref=e158]
                - cell "Low" [ref=e159]
                - cell "Pending" [ref=e160]:
                  - generic [ref=e161]: Pending
                - cell "Line Manager Review" [ref=e163]
                - cell "Review" [ref=e164]:
                  - button "Review" [ref=e165]
              - row "GHE-2025-0010 Thabo Mokoena Sales Entertainment Vodacom SA R 4 500 2025-06-12 Medium Pending Line Manager Review Review" [ref=e166]:
                - cell "GHE-2025-0010" [ref=e167]
                - cell "Thabo Mokoena" [ref=e168]
                - cell "Sales" [ref=e169]
                - cell "Entertainment" [ref=e170]
                - cell "Vodacom SA" [ref=e171]
                - cell "R 4 500" [ref=e172]
                - cell "2025-06-12" [ref=e173]
                - cell "Medium" [ref=e174]
                - cell "Pending" [ref=e175]:
                  - generic [ref=e176]: Pending
                - cell "Line Manager Review" [ref=e178]
                - cell "Review" [ref=e179]:
                  - button "Review" [ref=e180]
              - row "GHE-2025-0008 Ayanda Khumalo Operations Gift Deloitte SA R 800 2025-06-05 Low Pending Line Manager Review Review" [ref=e181]:
                - cell "GHE-2025-0008" [ref=e182]
                - cell "Ayanda Khumalo" [ref=e183]
                - cell "Operations" [ref=e184]
                - cell "Gift" [ref=e185]
                - cell "Deloitte SA" [ref=e186]
                - cell "R 800" [ref=e187]
                - cell "2025-06-05" [ref=e188]
                - cell "Low" [ref=e189]
                - cell "Pending" [ref=e190]:
                  - generic [ref=e191]: Pending
                - cell "Line Manager Review" [ref=e193]
                - cell "Review" [ref=e194]:
                  - button "Review" [ref=e195]
              - row "GHE-2025-0007 Pieter van der Berg Finance Hospitality Standard Bank R 3 800 2025-06-01 Medium Pending Line Manager Review Review" [ref=e196]:
                - cell "GHE-2025-0007" [ref=e197]
                - cell "Pieter van der Berg" [ref=e198]
                - cell "Finance" [ref=e199]
                - cell "Hospitality" [ref=e200]
                - cell "Standard Bank" [ref=e201]
                - cell "R 3 800" [ref=e202]
                - cell "2025-06-01" [ref=e203]
                - cell "Medium" [ref=e204]
                - cell "Pending" [ref=e205]:
                  - generic [ref=e206]: Pending
                - cell "Line Manager Review" [ref=e208]
                - cell "Review" [ref=e209]:
                  - button "Review" [ref=e210]
              - row "GHE-2025-0020 Lindiwe Zulu HR Hospitality The Campus Honeydew R 1 800 2025-06-18 Low Pending Line Manager Review Review" [ref=e211]:
                - cell "GHE-2025-0020" [ref=e212]
                - cell "Lindiwe Zulu" [ref=e213]
                - cell "HR" [ref=e214]
                - cell "Hospitality" [ref=e215]
                - cell "The Campus Honeydew" [ref=e216]
                - cell "R 1 800" [ref=e217]
                - cell "2025-06-18" [ref=e218]
                - cell "Low" [ref=e219]
                - cell "Pending" [ref=e220]:
                  - generic [ref=e221]: Pending
                - cell "Line Manager Review" [ref=e223]
                - cell "Review" [ref=e224]:
                  - button "Review" [ref=e225]
              - row "GHE-2025-0022 Sandile Shabalala Executive Entertainment SkyTracks Racing R 9 500 2025-06-22 High Pending Line Manager Review Review" [ref=e226]:
                - cell "GHE-2025-0022" [ref=e227]
                - cell "Sandile Shabalala" [ref=e228]
                - cell "Executive" [ref=e229]
                - cell "Entertainment" [ref=e230]
                - cell "SkyTracks Racing" [ref=e231]
                - cell "R 9 500" [ref=e232]
                - cell "2025-06-22" [ref=e233]
                - cell "High" [ref=e234]
                - cell "Pending" [ref=e235]:
                  - generic [ref=e236]: Pending
                - cell "Line Manager Review" [ref=e238]
                - cell "Review" [ref=e239]:
                  - button "Review" [ref=e240]
              - row "GHE-2026-411684 Nomvula Dlamini Marketing Gift Test23 R 24 134 2026-07-23 High Pending Line Manager Review Review" [ref=e241]:
                - cell "GHE-2026-411684" [ref=e242]
                - cell "Nomvula Dlamini" [ref=e243]
                - cell "Marketing" [ref=e244]
                - cell "Gift" [ref=e245]
                - cell "Test23" [ref=e246]
                - cell "R 24 134" [ref=e247]
                - cell "2026-07-23" [ref=e248]
                - cell "High" [ref=e249]
                - cell "Pending" [ref=e250]:
                  - generic [ref=e251]: Pending
                - cell "Line Manager Review" [ref=e253]
                - cell "Review" [ref=e254]:
                  - button "Review" [ref=e255]
          - generic [ref=e256]:
            - paragraph [ref=e257]: Showing 11 declarations
            - generic [ref=e258]:
              - button "Previous" [disabled] [ref=e259]
              - generic [ref=e260]: Page 1 of 2
              - button "Next" [ref=e261]
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
> 55  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
      |                                                                                                     ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
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
  81  |     await expect(this.page.locator(selector)).toBeVisible({ timeout });
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