# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Rejection at HR step
- Location: e2e\approval-flows.spec.ts:36:3

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
        - button "Dashboard" [ref=e14]:
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
          - generic [ref=e41]: LZ
          - generic [ref=e42]:
            - paragraph [ref=e43]: Lindiwe Zulu
            - paragraph [ref=e44]: Approver
        - button [ref=e45]:
          - img [ref=e46]
    - main [ref=e49]:
      - generic [ref=e50]:
        - generic [ref=e51]:
          - generic [ref=e52]:
            - heading "All Declarations" [level=1] [ref=e53]
            - paragraph [ref=e54]: 18 total declarations
          - generic [ref=e56]:
            - generic [ref=e57]:
              - button "My" [ref=e58]
              - button "All" [active] [ref=e59]
            - button "Clear Filters" [ref=e60]
            - button "Export Excel" [ref=e61]:
              - img [ref=e62]
              - text: Export Excel
        - generic [ref=e65]:
          - generic [ref=e66] [cursor=pointer]:
            - generic [ref=e67]:
              - generic [ref=e68]:
                - img [ref=e70]
                - generic [ref=e73]: Total
              - generic [ref=e74]: "18"
            - img
          - generic [ref=e75] [cursor=pointer]:
            - generic [ref=e76]:
              - generic [ref=e77]:
                - img [ref=e79]
                - generic [ref=e82]: Pending
              - generic [ref=e83]: "10"
            - img
          - generic [ref=e84] [cursor=pointer]:
            - generic [ref=e85]:
              - generic [ref=e86]:
                - img [ref=e88]
                - generic [ref=e90]: Approved
              - generic [ref=e91]: "6"
            - img
          - generic [ref=e92] [cursor=pointer]:
            - generic [ref=e93]:
              - generic [ref=e94]:
                - img [ref=e96]
                - generic [ref=e99]: Returned
              - generic [ref=e100]: "1"
            - img
          - generic [ref=e101] [cursor=pointer]:
            - generic [ref=e102]:
              - generic [ref=e103]:
                - img [ref=e105]
                - generic [ref=e108]: Declined
              - generic [ref=e109]: "1"
            - img
        - generic [ref=e110]:
          - generic [ref=e111]:
            - generic [ref=e112]: Search
            - textbox "ID, Counterparty, Employee or Approver" [ref=e113]
          - generic [ref=e114]:
            - generic [ref=e115]: Type
            - combobox [ref=e116] [cursor=pointer]:
              - option "All GHE" [selected]
              - option "Gift"
              - option "Hospitality"
              - option "Entertainment"
          - generic [ref=e117]:
            - generic [ref=e118]: Status
            - combobox [ref=e119] [cursor=pointer]:
              - option "All Status" [selected]
              - option "Pending"
              - option "Approved"
              - option "Declined"
              - option "Returned"
          - generic [ref=e120]:
            - generic [ref=e121]: Employee
            - combobox [ref=e122] [cursor=pointer]:
              - option "All Employees" [selected]
              - option "Nomvula Dlamini"
              - option "Sandile Shabalala"
              - option "Lindiwe Zulu"
              - option "Thabo Mokoena"
              - option "Ayanda Khumalo"
              - option "Pieter van der Berg"
              - option "Zanele Sithole"
              - option "Bongani Cele"
              - option "Fatima Ismail"
              - option "Siphamandla Ndlovu"
          - generic [ref=e123]:
            - generic [ref=e124]: Date From
            - textbox [ref=e125]
          - generic [ref=e126]:
            - generic [ref=e127]: Date To
            - textbox [ref=e128]
        - generic [ref=e129]:
          - table [ref=e130]:
            - rowgroup [ref=e131]:
              - row "Declaration ID Type Counterparty Value Submitted Final Approver Status Actions" [ref=e132]:
                - columnheader "Declaration ID" [ref=e133] [cursor=pointer]
                - columnheader "Type" [ref=e134] [cursor=pointer]
                - columnheader "Counterparty" [ref=e135] [cursor=pointer]
                - columnheader "Value" [ref=e136] [cursor=pointer]
                - columnheader "Submitted" [ref=e137] [cursor=pointer]
                - columnheader "Final Approver" [ref=e138] [cursor=pointer]
                - columnheader "Status" [ref=e139] [cursor=pointer]
                - columnheader "Actions" [ref=e140]
            - rowgroup [ref=e141]:
              - row "GHE-2026-411684 Gift Test23 R 24 134 2026-07-23 Sipho Nkosi Pending View Export" [ref=e142]:
                - cell "GHE-2026-411684" [ref=e143]
                - cell "Gift" [ref=e144]
                - cell "Test23" [ref=e145]
                - cell "R 24 134" [ref=e146]
                - cell "2026-07-23" [ref=e147]
                - cell "Sipho Nkosi" [ref=e148]
                - cell "Pending" [ref=e149]:
                  - generic [ref=e150]: Pending
                - cell "View Export" [ref=e152]:
                  - generic [ref=e153]:
                    - button "View" [ref=e154]:
                      - img [ref=e155]
                      - text: View
                    - button "Export" [ref=e158]:
                      - img [ref=e159]
                      - text: Export
              - row "GHE-2026-162078 Gift Testing123 R 2 411 2026-07-23 Sipho Nkosi Pending View Export" [ref=e162]:
                - cell "GHE-2026-162078" [ref=e163]
                - cell "Gift" [ref=e164]
                - cell "Testing123" [ref=e165]
                - cell "R 2 411" [ref=e166]
                - cell "2026-07-23" [ref=e167]
                - cell "Sipho Nkosi" [ref=e168]
                - cell "Pending" [ref=e169]:
                  - generic [ref=e170]: Pending
                - cell "View Export" [ref=e172]:
                  - generic [ref=e173]:
                    - button "View" [ref=e174]:
                      - img [ref=e175]
                      - text: View
                    - button "Export" [ref=e178]:
                      - img [ref=e179]
                      - text: Export
              - row "GHE-2025-0023 Gift Premier Soccer League R 450 2025-06-24 Sandile Shabalala Approved View Export" [ref=e182]:
                - cell "GHE-2025-0023" [ref=e183]
                - cell "Gift" [ref=e184]
                - cell "Premier Soccer League" [ref=e185]
                - cell "R 450" [ref=e186]
                - cell "2025-06-24" [ref=e187]
                - cell "Sandile Shabalala" [ref=e188]
                - cell "Approved" [ref=e189]:
                  - generic [ref=e190]: Approved
                - cell "View Export" [ref=e192]:
                  - generic [ref=e193]:
                    - button "View" [ref=e194]:
                      - img [ref=e195]
                      - text: View
                    - button "Export" [ref=e198]:
                      - img [ref=e199]
                      - text: Export
              - row "GHE-2025-0022 Entertainment SkyTracks Racing R 9 500 2025-06-22 Sandile Shabalala Pending View Export" [ref=e202]:
                - cell "GHE-2025-0022" [ref=e203]
                - cell "Entertainment" [ref=e204]
                - cell "SkyTracks Racing" [ref=e205]
                - cell "R 9 500" [ref=e206]
                - cell "2025-06-22" [ref=e207]
                - cell "Sandile Shabalala" [ref=e208]
                - cell "Pending" [ref=e209]:
                  - generic [ref=e210]: Pending
                - cell "View Export" [ref=e212]:
                  - generic [ref=e213]:
                    - button "View" [ref=e214]:
                      - img [ref=e215]
                      - text: View
                    - button "Export" [ref=e218]:
                      - img [ref=e219]
                      - text: Export
              - row "GHE-2025-0021 Gift Clicks R 320 2025-06-20 Sandile Shabalala Approved View Export" [ref=e222]:
                - cell "GHE-2025-0021" [ref=e223]
                - cell "Gift" [ref=e224]
                - cell "Clicks" [ref=e225]
                - cell "R 320" [ref=e226]
                - cell "2025-06-20" [ref=e227]
                - cell "Sandile Shabalala" [ref=e228]
                - cell "Approved" [ref=e229]:
                  - generic [ref=e230]: Approved
                - cell "View Export" [ref=e232]:
                  - generic [ref=e233]:
                    - button "View" [ref=e234]:
                      - img [ref=e235]
                      - text: View
                    - button "Export" [ref=e238]:
                      - img [ref=e239]
                      - text: Export
              - row "GHE-2025-0020 Hospitality The Campus Honeydew R 1 800 2025-06-18 Sandile Shabalala Pending View Export" [ref=e242]:
                - cell "GHE-2025-0020" [ref=e243]
                - cell "Hospitality" [ref=e244]
                - cell "The Campus Honeydew" [ref=e245]
                - cell "R 1 800" [ref=e246]
                - cell "2025-06-18" [ref=e247]
                - cell "Sandile Shabalala" [ref=e248]
                - cell "Pending" [ref=e249]:
                  - generic [ref=e250]: Pending
                - cell "View Export" [ref=e252]:
                  - generic [ref=e253]:
                    - button "View" [ref=e254]:
                      - img [ref=e255]
                      - text: View
                    - button "Export" [ref=e258]:
                      - img [ref=e259]
                      - text: Export
              - row "GHE-2025-0011 Gift Nike SA R 1 500 2025-06-15 Lindiwe Zulu Pending View Export" [ref=e262]:
                - cell "GHE-2025-0011" [ref=e263]
                - cell "Gift" [ref=e264]
                - cell "Nike SA" [ref=e265]
                - cell "R 1 500" [ref=e266]
                - cell "2025-06-15" [ref=e267]
                - cell "Lindiwe Zulu" [ref=e268]
                - cell "Pending" [ref=e269]:
                  - generic [ref=e270]: Pending
                - cell "View Export" [ref=e272]:
                  - generic [ref=e273]:
                    - button "View" [ref=e274]:
                      - img [ref=e275]
                      - text: View
                    - button "Export" [ref=e278]:
                      - img [ref=e279]
                      - text: Export
              - row "GHE-2025-0010 Entertainment Vodacom SA R 4 500 2025-06-12 Sandile Shabalala Pending View Export" [ref=e282]:
                - cell "GHE-2025-0010" [ref=e283]
                - cell "Entertainment" [ref=e284]
                - cell "Vodacom SA" [ref=e285]
                - cell "R 4 500" [ref=e286]
                - cell "2025-06-12" [ref=e287]
                - cell "Sandile Shabalala" [ref=e288]
                - cell "Pending" [ref=e289]:
                  - generic [ref=e290]: Pending
                - cell "View Export" [ref=e292]:
                  - generic [ref=e293]:
                    - button "View" [ref=e294]:
                      - img [ref=e295]
                      - text: View
                    - button "Export" [ref=e298]:
                      - img [ref=e299]
                      - text: Export
              - row "GHE-2025-0009 Hospitality Southern Sun R 2 200 2025-06-08 Lindiwe Zulu Approved View Export" [ref=e302]:
                - cell "GHE-2025-0009" [ref=e303]
                - cell "Hospitality" [ref=e304]
                - cell "Southern Sun" [ref=e305]
                - cell "R 2 200" [ref=e306]
                - cell "2025-06-08" [ref=e307]
                - cell "Lindiwe Zulu" [ref=e308]
                - cell "Approved" [ref=e309]:
                  - generic [ref=e310]: Approved
                - cell "View Export" [ref=e312]:
                  - generic [ref=e313]:
                    - button "View" [ref=e314]:
                      - img [ref=e315]
                      - text: View
                    - button "Export" [ref=e318]:
                      - img [ref=e319]
                      - text: Export
              - row "GHE-2025-0008 Gift Deloitte SA R 800 2025-06-05 Lindiwe Zulu Pending View Export" [ref=e322]:
                - cell "GHE-2025-0008" [ref=e323]
                - cell "Gift" [ref=e324]
                - cell "Deloitte SA" [ref=e325]
                - cell "R 800" [ref=e326]
                - cell "2025-06-05" [ref=e327]
                - cell "Lindiwe Zulu" [ref=e328]
                - cell "Pending" [ref=e329]:
                  - generic [ref=e330]: Pending
                - cell "View Export" [ref=e332]:
                  - generic [ref=e333]:
                    - button "View" [ref=e334]:
                      - img [ref=e335]
                      - text: View
                    - button "Export" [ref=e338]:
                      - img [ref=e339]
                      - text: Export
          - generic [ref=e342]:
            - paragraph [ref=e343]: Showing 18 declarations
            - generic [ref=e344]:
              - button "Previous" [disabled] [ref=e345]
              - generic [ref=e346]: Page 1 of 2
              - button "Next" [ref=e347]
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
> 76  |     await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
      |     ^ ReferenceError: expect is not defined
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