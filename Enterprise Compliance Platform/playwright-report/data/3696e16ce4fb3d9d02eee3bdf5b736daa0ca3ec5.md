# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Edge Cases & Error Handling >> Approver dashboard has Approval Queue link
- Location: e2e\approval-flows.spec.ts:290:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button:has-text("Approval Queue")')
Expected: visible
Error: strict mode violation: locator('button:has-text("Approval Queue")') resolved to 3 elements:
    1) <button class="w-full flex items-center gap-3 rounded-xl transition-all px-3 py-3 text-[16px] text-[#efe9ff] hover:bg-white/10 font-medium">…</button> aka getByRole('button', { name: 'Approval Queue', exact: true })
    2) <button class="min-w-0 flex-1 rounded-xl px-2 py-2 text-sm font-semibold transition-all text-gray-100 hover:bg-white/10">…</button> aka locator('button').filter({ hasText: 'Approval Queue' }).nth(1)
    3) <button class="flex h-10 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white transition-all hover:opacity-90 sm:w-auto">…</button> aka getByRole('button', { name: 'Approval Queue 6' })

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('button:has-text("Approval Queue")')

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
              - paragraph [ref=e54]: Inception to Date
            - button "Approval Queue 6" [ref=e56]:
              - img [ref=e57]
              - text: Approval Queue
              - generic [ref=e60]: "6"
          - generic [ref=e61]:
            - generic [ref=e62] [cursor=pointer]:
              - generic [ref=e63]:
                - generic [ref=e64]: ◷
                - text: Pending Queue
              - generic [ref=e66]: "2"
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
              - generic [ref=e111]: R 12 200
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
                    - paragraph [ref=e127]: Nomvula Dlamini
                    - paragraph [ref=e128]: R 12 200
                  - paragraph [ref=e130]: G 0 · H 1 · E 0
                  - paragraph [ref=e132]: G 0 · H 0 · E 0
                - generic [ref=e134]:
                  - generic [ref=e135]:
                    - paragraph [ref=e136]: Siphamandla Ndlovu
                    - paragraph [ref=e137]: R 5 600
                  - paragraph [ref=e139]: G 0 · H 0 · E 0
                  - paragraph [ref=e141]: G 0 · H 0 · E 0
            - generic [ref=e142]:
              - generic [ref=e143]:
                - img [ref=e144]
                - paragraph [ref=e149]: GHE Distribution
              - generic [ref=e150]:
                - img [ref=e154]:
                  - generic [ref=e155]:
                    - img [ref=e157]
                    - img [ref=e159]
                - generic [ref=e160]:
                  - generic [ref=e161]:
                    - paragraph [ref=e162]: Gift
                    - paragraph [ref=e163]: 1 · 25%
                  - generic [ref=e164]:
                    - paragraph [ref=e165]: Hospitality
                    - paragraph [ref=e166]: 3 · 75%
            - generic [ref=e167]:
              - generic [ref=e168]:
                - img [ref=e169]
                - paragraph [ref=e171]: Overdue 7+ Days
              - generic [ref=e172]:
                - button "GHE-2024-0047 Nomvula Dlamini · 689 days High" [ref=e173]:
                  - generic [ref=e174]:
                    - paragraph [ref=e175]: GHE-2024-0047
                    - paragraph [ref=e176]: Nomvula Dlamini · 689 days
                  - generic [ref=e177]: High
                - button "GHE-2025-0011 Nomvula Dlamini · 474 days Low" [ref=e178]:
                  - generic [ref=e179]:
                    - paragraph [ref=e180]: GHE-2025-0011
                    - paragraph [ref=e181]: Nomvula Dlamini · 474 days
                  - generic [ref=e182]: Low
          - generic [ref=e183]:
            - generic [ref=e184]:
              - heading "Department Insights" [level=3] [ref=e185]
              - paragraph [ref=e186]:
                - strong [ref=e187]: "4"
                - text: Total Declarations
            - table [ref=e189]:
              - rowgroup [ref=e190]:
                - row "Department Declarations Pending Approved Declined Total Value" [ref=e191]:
                  - columnheader "Department" [ref=e192]
                  - columnheader "Declarations" [ref=e193]
                  - columnheader "Pending" [ref=e194]
                  - columnheader "Approved" [ref=e195]
                  - columnheader "Declined" [ref=e196]
                  - columnheader "Total Value" [ref=e197]
              - rowgroup [ref=e198]:
                - row "Marketing 4 2 1 0 R 17 800" [ref=e199]:
                  - cell "Marketing" [ref=e200]
                  - cell "4" [ref=e201]
                  - cell "2" [ref=e202]
                  - cell "1" [ref=e203]
                  - cell "0" [ref=e204]
                  - cell "R 17 800" [ref=e205]
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
  30  |   await page.locator(`aside nav button:has-text("${label}"):visible, nav button:has-text("${label}"):visible`).first().click();
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
> 85  |     await expect(this.page.locator(selector)).toBeVisible({ timeout });
      |                                               ^ Error: expect(locator).toBeVisible() failed
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
  131 |   }
  132 | 
  133 |   async getId(): Promise<string> {
  134 |     const text = await this.page.locator("span.font-mono.font-bold").textContent();
  135 |     return text?.trim() ?? "";
  136 |   }
  137 | 
  138 |   async closeModal() {
  139 |     const btn = this.page.getByRole("button", { name: "Close" });
  140 |     if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
  141 |       await btn.click();
  142 |     }
  143 |   }
  144 | }
  145 | 
```