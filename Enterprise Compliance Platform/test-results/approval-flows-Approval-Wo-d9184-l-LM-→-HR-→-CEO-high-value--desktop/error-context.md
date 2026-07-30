# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Full approval: LM → HR → CEO (high-value)
- Location: e2e\approval-flows.spec.ts:11:3

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
        - button "Reports" [ref=e31]:
          - img [ref=e32]
          - text: Reports
  - generic [ref=e34]:
    - banner [ref=e35]:
      - generic [ref=e40]: Gift, Hospitality or Entertainment ("GHE") Declaration System
      - generic [ref=e41]:
        - generic [ref=e43]:
          - generic [ref=e44]: SS
          - generic [ref=e45]:
            - paragraph [ref=e46]: Sandile Shabalala
            - paragraph [ref=e47]: Approver
        - button [ref=e48]:
          - img [ref=e49]
    - main [ref=e52]:
      - generic [ref=e53]:
        - generic [ref=e54]:
          - generic [ref=e55]:
            - heading "All Declarations" [level=1] [ref=e56]
            - paragraph [ref=e57]: 18 total declarations
          - generic [ref=e59]:
            - generic [ref=e60]:
              - button "My" [ref=e61]
              - button "All" [active] [ref=e62]
            - button "Clear Filters" [ref=e63]
            - button "Export Excel" [ref=e64]:
              - img [ref=e65]
              - text: Export Excel
        - generic [ref=e68]:
          - generic [ref=e69] [cursor=pointer]:
            - generic [ref=e70]:
              - generic [ref=e71]:
                - img [ref=e73]
                - generic [ref=e76]: Total
              - generic [ref=e77]: "18"
            - img
          - generic [ref=e78] [cursor=pointer]:
            - generic [ref=e79]:
              - generic [ref=e80]:
                - img [ref=e82]
                - generic [ref=e85]: Pending
              - generic [ref=e86]: "11"
            - img
          - generic [ref=e87] [cursor=pointer]:
            - generic [ref=e88]:
              - generic [ref=e89]:
                - img [ref=e91]
                - generic [ref=e93]: Approved
              - generic [ref=e94]: "6"
            - img
          - generic [ref=e95] [cursor=pointer]:
            - generic [ref=e96]:
              - generic [ref=e97]:
                - img [ref=e99]
                - generic [ref=e102]: Returned
              - generic [ref=e103]: "1"
            - img
          - generic [ref=e104] [cursor=pointer]:
            - generic [ref=e105]:
              - generic [ref=e106]:
                - img [ref=e108]
                - generic [ref=e111]: Declined
              - generic [ref=e112]: "0"
            - img
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e115]: Search
            - textbox "ID, Counterparty, Employee or Approver" [ref=e116]
          - generic [ref=e117]:
            - generic [ref=e118]: Type
            - combobox [ref=e119] [cursor=pointer]:
              - option "All GHE" [selected]
              - option "Gift"
              - option "Hospitality"
              - option "Entertainment"
          - generic [ref=e120]:
            - generic [ref=e121]: Status
            - combobox [ref=e122] [cursor=pointer]:
              - option "All Status" [selected]
              - option "Pending"
              - option "Approved"
              - option "Declined"
              - option "Returned"
          - generic [ref=e123]:
            - generic [ref=e124]: Employee
            - combobox [ref=e125] [cursor=pointer]:
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
          - generic [ref=e126]:
            - generic [ref=e127]: Date From
            - textbox [ref=e128]
          - generic [ref=e129]:
            - generic [ref=e130]: Date To
            - textbox [ref=e131]
        - generic [ref=e132]:
          - table [ref=e133]:
            - rowgroup [ref=e134]:
              - row "Declaration ID Type Counterparty Value Submitted Final Approver Status Actions" [ref=e135]:
                - columnheader "Declaration ID" [ref=e136] [cursor=pointer]
                - columnheader "Type" [ref=e137] [cursor=pointer]
                - columnheader "Counterparty" [ref=e138] [cursor=pointer]
                - columnheader "Value" [ref=e139] [cursor=pointer]
                - columnheader "Submitted" [ref=e140] [cursor=pointer]
                - columnheader "Final Approver" [ref=e141] [cursor=pointer]
                - columnheader "Status" [ref=e142] [cursor=pointer]
                - columnheader "Actions" [ref=e143]
            - rowgroup [ref=e144]:
              - row "GHE-2026-411684 Gift Test23 R 24 134 2026-07-23 Sipho Nkosi Pending View Export" [ref=e145]:
                - cell "GHE-2026-411684" [ref=e146]
                - cell "Gift" [ref=e147]
                - cell "Test23" [ref=e148]
                - cell "R 24 134" [ref=e149]
                - cell "2026-07-23" [ref=e150]
                - cell "Sipho Nkosi" [ref=e151]
                - cell "Pending" [ref=e152]:
                  - generic [ref=e153]: Pending
                - cell "View Export" [ref=e155]:
                  - generic [ref=e156]:
                    - button "View" [ref=e157]:
                      - img [ref=e158]
                      - text: View
                    - button "Export" [ref=e161]:
                      - img [ref=e162]
                      - text: Export
              - row "GHE-2026-162078 Gift Testing123 R 2 411 2026-07-23 Sipho Nkosi Pending View Export" [ref=e165]:
                - cell "GHE-2026-162078" [ref=e166]
                - cell "Gift" [ref=e167]
                - cell "Testing123" [ref=e168]
                - cell "R 2 411" [ref=e169]
                - cell "2026-07-23" [ref=e170]
                - cell "Sipho Nkosi" [ref=e171]
                - cell "Pending" [ref=e172]:
                  - generic [ref=e173]: Pending
                - cell "View Export" [ref=e175]:
                  - generic [ref=e176]:
                    - button "View" [ref=e177]:
                      - img [ref=e178]
                      - text: View
                    - button "Export" [ref=e181]:
                      - img [ref=e182]
                      - text: Export
              - row "GHE-2025-0023 Gift Premier Soccer League R 450 2025-06-24 Sandile Shabalala Approved View Export" [ref=e185]:
                - cell "GHE-2025-0023" [ref=e186]
                - cell "Gift" [ref=e187]
                - cell "Premier Soccer League" [ref=e188]
                - cell "R 450" [ref=e189]
                - cell "2025-06-24" [ref=e190]
                - cell "Sandile Shabalala" [ref=e191]
                - cell "Approved" [ref=e192]:
                  - generic [ref=e193]: Approved
                - cell "View Export" [ref=e195]:
                  - generic [ref=e196]:
                    - button "View" [ref=e197]:
                      - img [ref=e198]
                      - text: View
                    - button "Export" [ref=e201]:
                      - img [ref=e202]
                      - text: Export
              - row "GHE-2025-0022 Entertainment SkyTracks Racing R 9 500 2025-06-22 Sandile Shabalala Pending View Export" [ref=e205]:
                - cell "GHE-2025-0022" [ref=e206]
                - cell "Entertainment" [ref=e207]
                - cell "SkyTracks Racing" [ref=e208]
                - cell "R 9 500" [ref=e209]
                - cell "2025-06-22" [ref=e210]
                - cell "Sandile Shabalala" [ref=e211]
                - cell "Pending" [ref=e212]:
                  - generic [ref=e213]: Pending
                - cell "View Export" [ref=e215]:
                  - generic [ref=e216]:
                    - button "View" [ref=e217]:
                      - img [ref=e218]
                      - text: View
                    - button "Export" [ref=e221]:
                      - img [ref=e222]
                      - text: Export
              - row "GHE-2025-0021 Gift Clicks R 320 2025-06-20 Sandile Shabalala Approved View Export" [ref=e225]:
                - cell "GHE-2025-0021" [ref=e226]
                - cell "Gift" [ref=e227]
                - cell "Clicks" [ref=e228]
                - cell "R 320" [ref=e229]
                - cell "2025-06-20" [ref=e230]
                - cell "Sandile Shabalala" [ref=e231]
                - cell "Approved" [ref=e232]:
                  - generic [ref=e233]: Approved
                - cell "View Export" [ref=e235]:
                  - generic [ref=e236]:
                    - button "View" [ref=e237]:
                      - img [ref=e238]
                      - text: View
                    - button "Export" [ref=e241]:
                      - img [ref=e242]
                      - text: Export
              - row "GHE-2025-0020 Hospitality The Campus Honeydew R 1 800 2025-06-18 Sandile Shabalala Pending View Export" [ref=e245]:
                - cell "GHE-2025-0020" [ref=e246]
                - cell "Hospitality" [ref=e247]
                - cell "The Campus Honeydew" [ref=e248]
                - cell "R 1 800" [ref=e249]
                - cell "2025-06-18" [ref=e250]
                - cell "Sandile Shabalala" [ref=e251]
                - cell "Pending" [ref=e252]:
                  - generic [ref=e253]: Pending
                - cell "View Export" [ref=e255]:
                  - generic [ref=e256]:
                    - button "View" [ref=e257]:
                      - img [ref=e258]
                      - text: View
                    - button "Export" [ref=e261]:
                      - img [ref=e262]
                      - text: Export
              - row "GHE-2025-0011 Gift Nike SA R 1 500 2025-06-15 Lindiwe Zulu Pending View Export" [ref=e265]:
                - cell "GHE-2025-0011" [ref=e266]
                - cell "Gift" [ref=e267]
                - cell "Nike SA" [ref=e268]
                - cell "R 1 500" [ref=e269]
                - cell "2025-06-15" [ref=e270]
                - cell "Lindiwe Zulu" [ref=e271]
                - cell "Pending" [ref=e272]:
                  - generic [ref=e273]: Pending
                - cell "View Export" [ref=e275]:
                  - generic [ref=e276]:
                    - button "View" [ref=e277]:
                      - img [ref=e278]
                      - text: View
                    - button "Export" [ref=e281]:
                      - img [ref=e282]
                      - text: Export
              - row "GHE-2025-0010 Entertainment Vodacom SA R 4 500 2025-06-12 Sandile Shabalala Pending View Export" [ref=e285]:
                - cell "GHE-2025-0010" [ref=e286]
                - cell "Entertainment" [ref=e287]
                - cell "Vodacom SA" [ref=e288]
                - cell "R 4 500" [ref=e289]
                - cell "2025-06-12" [ref=e290]
                - cell "Sandile Shabalala" [ref=e291]
                - cell "Pending" [ref=e292]:
                  - generic [ref=e293]: Pending
                - cell "View Export" [ref=e295]:
                  - generic [ref=e296]:
                    - button "View" [ref=e297]:
                      - img [ref=e298]
                      - text: View
                    - button "Export" [ref=e301]:
                      - img [ref=e302]
                      - text: Export
              - row "GHE-2025-0009 Hospitality Southern Sun R 2 200 2025-06-08 Lindiwe Zulu Approved View Export" [ref=e305]:
                - cell "GHE-2025-0009" [ref=e306]
                - cell "Hospitality" [ref=e307]
                - cell "Southern Sun" [ref=e308]
                - cell "R 2 200" [ref=e309]
                - cell "2025-06-08" [ref=e310]
                - cell "Lindiwe Zulu" [ref=e311]
                - cell "Approved" [ref=e312]:
                  - generic [ref=e313]: Approved
                - cell "View Export" [ref=e315]:
                  - generic [ref=e316]:
                    - button "View" [ref=e317]:
                      - img [ref=e318]
                      - text: View
                    - button "Export" [ref=e321]:
                      - img [ref=e322]
                      - text: Export
              - row "GHE-2025-0008 Gift Deloitte SA R 800 2025-06-05 Lindiwe Zulu Pending View Export" [ref=e325]:
                - cell "GHE-2025-0008" [ref=e326]
                - cell "Gift" [ref=e327]
                - cell "Deloitte SA" [ref=e328]
                - cell "R 800" [ref=e329]
                - cell "2025-06-05" [ref=e330]
                - cell "Lindiwe Zulu" [ref=e331]
                - cell "Pending" [ref=e332]:
                  - generic [ref=e333]: Pending
                - cell "View Export" [ref=e335]:
                  - generic [ref=e336]:
                    - button "View" [ref=e337]:
                      - img [ref=e338]
                      - text: View
                    - button "Export" [ref=e341]:
                      - img [ref=e342]
                      - text: Export
          - generic [ref=e345]:
            - paragraph [ref=e346]: Showing 18 declarations
            - generic [ref=e347]:
              - button "Previous" [disabled] [ref=e348]
              - generic [ref=e349]: Page 1 of 2
              - button "Next" [ref=e350]
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