# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Admin — User Management >> Admin creates a new user
- Location: e2e\approval-flows.spec.ts:175:3

# Error details

```
TimeoutError: locator.click: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('aside nav button:has-text("Users"):visible, nav button:has-text("Users"):visible').first()

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
            - generic [ref=e41]: AP
            - generic [ref=e42]:
              - paragraph [ref=e43]: Aisha Patel
              - paragraph [ref=e44]: Approver
          - button [ref=e45]:
            - img [ref=e46]
      - main [ref=e49]:
        - generic [ref=e50]:
          - generic [ref=e51]:
            - generic [ref=e52]:
              - heading "Approver Dashboard" [level=1] [ref=e53]
              - paragraph [ref=e54]: Inception to Date
            - button "Approval Queue 0" [ref=e56]:
              - img [ref=e57]
              - text: Approval Queue
              - generic [ref=e60]: "0"
          - generic [ref=e61]:
            - generic [ref=e62] [cursor=pointer]:
              - generic [ref=e63]:
                - generic [ref=e64]: ◷
                - text: Pending Queue
              - generic [ref=e66]: "3"
            - generic [ref=e75] [cursor=pointer]:
              - generic [ref=e76]:
                - generic [ref=e77]: ✓
                - text: Approved
              - generic [ref=e79]: "1"
              - generic [ref=e83]: ✓
            - generic [ref=e84] [cursor=pointer]:
              - generic [ref=e85]:
                - generic [ref=e86]: ↶
                - text: Returned
              - generic [ref=e88]: "0"
              - img [ref=e89]
            - generic [ref=e92] [cursor=pointer]:
              - generic [ref=e93]:
                - generic [ref=e94]: ×
                - text: Declined
              - generic [ref=e96]: "0"
              - generic [ref=e101]: ×
            - generic [ref=e102]:
              - generic [ref=e103]:
                - img [ref=e105]
                - text: Total Value
              - generic [ref=e111]: R 18 100
          - generic [ref=e112]:
            - generic [ref=e113]:
              - generic [ref=e114]:
                - img [ref=e115]
                - paragraph [ref=e118]: Team Member Activity
              - generic [ref=e119]:
                - generic [ref=e120]:
                  - generic [ref=e122]: Approved
                  - generic [ref=e123]: Declined
                - generic [ref=e125]:
                  - generic [ref=e126]:
                    - paragraph [ref=e127]: Ravi Sharma
                    - paragraph [ref=e128]: R 12 500
                  - paragraph [ref=e130]: G 0 · H 0 · E 0
                  - paragraph [ref=e132]: G 0 · H 0 · E 0
                - generic [ref=e134]:
                  - generic [ref=e135]:
                    - paragraph [ref=e136]: Nomsa Dlamini
                    - paragraph [ref=e137]: R 4 200
                  - paragraph [ref=e139]: G 0 · H 0 · E 0
                  - paragraph [ref=e141]: G 0 · H 0 · E 0
                - generic [ref=e143]:
                  - generic [ref=e144]:
                    - paragraph [ref=e145]: Lebo Mokoena
                    - paragraph [ref=e146]: R 2 200
                  - paragraph [ref=e148]: G 0 · H 0 · E 0
                  - paragraph [ref=e150]: G 0 · H 0 · E 0
                - generic [ref=e152]:
                  - generic [ref=e153]:
                    - paragraph [ref=e154]: Kabelo Molefe
                    - paragraph [ref=e155]: R 750
                  - paragraph [ref=e157]: G 0 · H 0 · E 0
                  - paragraph [ref=e159]: G 0 · H 0 · E 0
                - generic [ref=e161]:
                  - generic [ref=e162]:
                    - paragraph [ref=e163]: Sipho Ndlovu
                    - paragraph [ref=e164]: R 650
                  - paragraph [ref=e166]: G 0 · H 1 · E 0
                  - paragraph [ref=e168]: G 0 · H 0 · E 0
            - generic [ref=e169]:
              - generic [ref=e170]:
                - img [ref=e171]
                - paragraph [ref=e176]: GHE Distribution
              - generic [ref=e177]:
                - img [ref=e181]:
                  - generic [ref=e182]:
                    - img [ref=e184]
                    - img [ref=e186]
                    - img [ref=e188]
                - generic [ref=e189]:
                  - generic [ref=e190]:
                    - paragraph [ref=e191]: Hospitality
                    - paragraph [ref=e192]: 2 · 40%
                  - generic [ref=e193]:
                    - paragraph [ref=e194]: Gift
                    - paragraph [ref=e195]: 2 · 40%
                  - generic [ref=e196]:
                    - paragraph [ref=e197]: Entertainment
                    - paragraph [ref=e198]: 1 · 20%
            - generic [ref=e199]:
              - generic [ref=e200]:
                - img [ref=e201]
                - paragraph [ref=e203]: Overdue 7+ Days
              - generic [ref=e204]:
                - button "GHE-NPN-0001 Kabelo Molefe · 479 days Low" [ref=e205]:
                  - generic [ref=e206]:
                    - paragraph [ref=e207]: GHE-NPN-0001
                    - paragraph [ref=e208]: Kabelo Molefe · 479 days
                  - generic [ref=e209]: Low
                - button "GHE-NPN-0002 Nomsa Dlamini · 477 days Medium" [ref=e210]:
                  - generic [ref=e211]:
                    - paragraph [ref=e212]: GHE-NPN-0002
                    - paragraph [ref=e213]: Nomsa Dlamini · 477 days
                  - generic [ref=e214]: Medium
                - button "GHE-NPN-0003 Ravi Sharma · 474 days High" [ref=e215]:
                  - generic [ref=e216]:
                    - paragraph [ref=e217]: GHE-NPN-0003
                    - paragraph [ref=e218]: Ravi Sharma · 474 days
                  - generic [ref=e219]: High
          - generic [ref=e220]:
            - generic [ref=e221]:
              - heading "Department Insights" [level=3] [ref=e222]
              - paragraph [ref=e223]:
                - strong [ref=e224]: "5"
                - text: Total Declarations
            - table [ref=e226]:
              - rowgroup [ref=e227]:
                - row "Department Declarations Pending Approved Declined Total Value" [ref=e228]:
                  - columnheader "Department" [ref=e229]
                  - columnheader "Declarations" [ref=e230]
                  - columnheader "Pending" [ref=e231]
                  - columnheader "Approved" [ref=e232]
                  - columnheader "Declined" [ref=e233]
                  - columnheader "Total Value" [ref=e234]
              - rowgroup [ref=e235]:
                - row "Marketing 1 1 0 0 R 12 500" [ref=e236]:
                  - cell "Marketing" [ref=e237]
                  - cell "1" [ref=e238]
                  - cell "1" [ref=e239]
                  - cell "0" [ref=e240]
                  - cell "0" [ref=e241]
                  - cell "R 12 500" [ref=e242]
                - row "Finance 1 1 0 0 R 4 200" [ref=e243]:
                  - cell "Finance" [ref=e244]
                  - cell "1" [ref=e245]
                  - cell "1" [ref=e246]
                  - cell "0" [ref=e247]
                  - cell "0" [ref=e248]
                  - cell "R 4 200" [ref=e249]
                - row "Legal 1 0 0 0 R 2 200" [ref=e250]:
                  - cell "Legal" [ref=e251]
                  - cell "1" [ref=e252]
                  - cell "0" [ref=e253]
                  - cell "0" [ref=e254]
                  - cell "0" [ref=e255]
                  - cell "R 2 200" [ref=e256]
                - row "Engineering 1 1 0 0 R 750" [ref=e257]:
                  - cell "Engineering" [ref=e258]
                  - cell "1" [ref=e259]
                  - cell "1" [ref=e260]
                  - cell "0" [ref=e261]
                  - cell "0" [ref=e262]
                  - cell "R 750" [ref=e263]
                - row "Operations 1 0 1 0 R 650" [ref=e264]:
                  - cell "Operations" [ref=e265]
                  - cell "1" [ref=e266]
                  - cell "0" [ref=e267]
                  - cell "1" [ref=e268]
                  - cell "0" [ref=e269]
                  - cell "R 650" [ref=e270]
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
  7   |   sandile:  { email: "sandile@hb.co.za",  role: "approver",   name: "Sandile Shabalala" },
  8   |   admin:    { email: "admin@hb.co.za",    role: "admin",      name: "Admin User" },
  9   | };
  10  | 
  11  | export const LOGIN_INDEX: Record<string, number> = {
  12  |   "nomvula@hb.co.za": 0,
  13  |   "sipho@hb.co.za": 1,
  14  |   "lindiwe@hb.co.za": 4,
  15  |   "sandile@hb.co.za": 3,
  16  |   "admin@hb.co.za": 5,
  17  | };
  18  | 
  19  | export async function login(page: Page, email: string) {
  20  |   await page.goto("/");
  21  |   await page.waitForSelector("select", { timeout: 10000 });
  22  |   await page.selectOption("select", String(LOGIN_INDEX[email]));
  23  |   await page.click('button[type="submit"]');
  24  |   // Desktop renders the sidebar inside <aside>; mobile renders the compact
  25  |   // navigation as a top-level <nav>.
  26  |   await page.waitForSelector("aside nav, nav", { timeout: 15000 });
  27  | }
  28  | 
  29  | export async function clickSidebar(page: Page, label: string) {
> 30  |   await page.locator(`aside nav button:has-text("${label}"):visible, nav button:has-text("${label}"):visible`).first().click();
      |                                                                                                                        ^ TimeoutError: locator.click: Timeout 15000ms exceeded.
  31  | }
  32  | 
  33  | export class AppPage {
  34  |   constructor(public page: Page) {}
  35  | 
  36  |   async open() {
  37  |     await this.page.goto("/");
  38  |     await this.page.waitForSelector("select", { timeout: 10000 });
  39  |   }
  40  | 
  41  |   async login(email: string) {
  42  |     await login(this.page, email);
  43  |   }
  44  | 
  45  |   async sidebar(label: string) {
  46  |     await clickSidebar(this.page, label);
  47  |   }
  48  | 
  49  |   async search(id: string) {
  50  |     const input = this.page.locator('input[placeholder*="Search"], input[placeholder*="Declaration"]');
  51  |     if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
  52  |       await input.fill(id);
  53  |       await this.page.waitForTimeout(400);
  54  |     }
  55  |   }
  56  | 
  57  |   async clickReviewFor(id: string) {
  58  |     await this.search(id);
  59  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
  60  |   }
  61  | 
  62  |   async pickDecision(label: string) {
  63  |     await this.page
  64  |       .locator(`label:has-text("${label}")`)
  65  |       .first()
  66  |       .click();
  67  |     await this.page.waitForTimeout(300);
  68  |   }
  69  | 
  70  |   async submitDecision() {
  71  |     await this.page.click('button:has-text("Submit Decision")');
  72  |     await this.page.getByText("Decision submitted", { timeout: 10000 }).waitFor();
  73  |   }
  74  | 
  75  |   async verifyStatus(declarationId: string, status: string) {
  76  |     await this.sidebar("All Declarations");
  77  |     await this.page.getByRole("button", { name: "All", exact: true }).click();
  78  | 
  79  |     await this.search(declarationId);
  80  |     await expect(this.page.locator(`table td:has-text("${declarationId}")`).first()).toBeVisible({ timeout: 10000 });
  81  |     await expect(this.page.locator(`table td span:has-text("${status}")`).first()).toBeVisible({ timeout: 10000 });
  82  |   }
  83  | 
  84  |   async assertVisible(selector: string, timeout = 10000) {
  85  |     await expect(this.page.locator(selector)).toBeVisible({ timeout });
  86  |   }
  87  | }
  88  | 
  89  | export class NewDeclarationPage {
  90  |   constructor(public page: Page) {}
  91  | 
  92  |   async open() {
  93  |     await this.page.click('button:has-text("New Declaration")');
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
  119 | 
  120 |   async date(value: string) {
  121 |     await this.page.locator('input[type="date"]').fill(value);
  122 |   }
  123 | 
  124 |   async number(label: string, value: string) {
  125 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
  126 |   }
  127 | 
  128 |   async submit() {
  129 |     await this.page.click('button:has-text("Submit Declaration")');
  130 |     await this.page.getByText("Declaration Submitted", { timeout: 15000 }).waitFor();
```