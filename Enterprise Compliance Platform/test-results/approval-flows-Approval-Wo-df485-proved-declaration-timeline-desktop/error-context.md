# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Approval Workflow — Full Flow >> Team member views approved declaration timeline
- Location: e2e\approval-flows.spec.ts:99:3

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
      - paragraph [ref=e12]: Team Member
      - generic [ref=e13]:
        - button "New Declaration" [ref=e14]:
          - img [ref=e15]
          - text: New Declaration
        - button "My Declarations" [ref=e19]:
          - img [ref=e20]
          - text: My Declarations
  - generic [ref=e23]:
    - banner [ref=e24]:
      - generic [ref=e29]: Gift, Hospitality or Entertainment ("GHE") Declaration System
      - generic [ref=e30]:
        - generic [ref=e32]:
          - generic [ref=e33]: ND
          - generic [ref=e34]:
            - paragraph [ref=e35]: Nomvula Dlamini
            - paragraph [ref=e36]: Team Member
        - button [ref=e37]:
          - img [ref=e38]
    - main [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]:
          - button "Back" [ref=e44]:
            - img [ref=e45]
            - text: Back
          - generic [ref=e47]: GHE-2026-411684
          - generic [ref=e49]: Pending
        - generic [ref=e51]:
          - generic [ref=e56]:
            - heading "Declaration Details" [level=2] [ref=e57]
            - generic [ref=e58]:
              - generic [ref=e59]:
                - paragraph [ref=e60]: Team Member
                - paragraph [ref=e61]: Nomvula Dlamini
              - generic [ref=e62]:
                - paragraph [ref=e63]: Team Member Code
                - paragraph [ref=e64]: HB-204478
              - generic [ref=e65]:
                - paragraph [ref=e66]: Manager
                - paragraph [ref=e67]: Sipho Nkosi
              - generic [ref=e68]:
                - paragraph [ref=e69]: Company
                - paragraph [ref=e70]: Hollywoodbets Group
              - generic [ref=e71]:
                - paragraph [ref=e72]: Department
                - paragraph [ref=e73]: Marketing
              - generic [ref=e74]:
                - paragraph [ref=e75]: Position
                - paragraph [ref=e76]: Senior Brand Manager
              - generic [ref=e77]:
                - paragraph [ref=e78]: GHE Received/Given
                - paragraph [ref=e79]: Received
              - generic [ref=e80]:
                - paragraph [ref=e81]: Category
                - paragraph [ref=e82]: Gift
              - generic [ref=e83]:
                - paragraph [ref=e84]: Counter Party
                - paragraph [ref=e85]: Test23
              - generic [ref=e86]:
                - paragraph [ref=e87]: Counter Party Name
                - paragraph [ref=e88]: Test23
              - generic [ref=e89]:
                - paragraph [ref=e90]: Name Of Counter Person
                - paragraph [ref=e91]: Test23
              - generic [ref=e92]:
                - paragraph [ref=e93]: Date
                - paragraph [ref=e94]: 2026-07-23
              - generic [ref=e95]:
                - paragraph [ref=e96]: Value
                - paragraph [ref=e97]: R 24 134
              - generic [ref=e98]:
                - paragraph [ref=e99]: Reason/Occasion
                - paragraph [ref=e100]: Business Meeting
              - generic [ref=e101]:
                - paragraph [ref=e102]: Bid In Progress
                - paragraph [ref=e103]: "Yes"
              - generic [ref=e104]:
                - paragraph [ref=e105]: Contract In Progress
                - paragraph [ref=e106]: "Yes"
              - generic [ref=e107]:
                - paragraph [ref=e108]: No. of GHE past 12 months
                - paragraph [ref=e109]: "3"
              - generic [ref=e110]:
                - paragraph [ref=e111]: Description
                - paragraph [ref=e112]: Test23
              - generic [ref=e113]:
                - paragraph [ref=e114]: Substantiation (> R2000)
                - paragraph [ref=e115]: Test23
          - generic [ref=e119]:
            - generic [ref=e120]:
              - img [ref=e122]
              - heading "Approval Workflow" [level=1] [ref=e128]
            - generic [ref=e129]:
              - generic [ref=e134]:
                - generic [ref=e135]:
                  - generic [ref=e136]:
                    - paragraph [ref=e137]: 1. Line Manager Approval
                    - paragraph [ref=e138]: Sipho Nkosi
                  - generic [ref=e139]: In Progress
                - generic [ref=e140]:
                  - paragraph [ref=e141]:
                    - text: Awaiting action from
                    - strong [ref=e142]: Sipho Nkosi
                  - generic [ref=e143]:
                    - generic [ref=e144]: Status
                    - generic [ref=e145]: Pending
                  - generic [ref=e146]:
                    - generic [ref=e147]: Date
                    - generic [ref=e148]: "-"
                  - generic [ref=e149]:
                    - generic [ref=e150]: Time
                    - generic [ref=e151]: "-"
              - generic [ref=e156]:
                - generic [ref=e157]:
                  - generic [ref=e158]:
                    - paragraph [ref=e159]: 2. Head of HR Approval
                    - paragraph [ref=e160]: Lindiwe Zulu
                  - generic [ref=e161]: Pending
                - generic [ref=e162]:
                  - generic [ref=e163]:
                    - generic [ref=e164]: Status
                    - generic [ref=e165]: Pending
                  - generic [ref=e166]:
                    - generic [ref=e167]: Date
                    - generic [ref=e168]: "-"
                  - generic [ref=e169]:
                    - generic [ref=e170]: Time
                    - generic [ref=e171]: "-"
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - generic [ref=e177]:
                    - paragraph [ref=e178]: 3. Group CEO Approval
                    - paragraph [ref=e179]: Sandile Shabalala
                  - generic [ref=e180]: Pending
                - generic [ref=e181]:
                  - generic [ref=e182]:
                    - generic [ref=e183]: Status
                    - generic [ref=e184]: Pending
                  - generic [ref=e185]:
                    - generic [ref=e186]: Date
                    - generic [ref=e187]: "-"
                  - generic [ref=e188]:
                    - generic [ref=e189]: Time
                    - generic [ref=e190]: "-"
          - generic [ref=e195]:
            - heading "Supporting Documents" [level=3] [ref=e196]
            - generic [ref=e198]: No supporting documents were uploaded for this declaration.
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