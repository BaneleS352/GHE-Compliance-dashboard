# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Declaration Creation >> Approver creates and submits a declaration (LM verifies)
- Location: e2e\approval-flows.spec.ts:148:3

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
        - button "New Declaration" [active] [ref=e18]:
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
        - complementary [ref=e51]:
          - generic [ref=e52]:
            - paragraph [ref=e53]: Sections
            - navigation [ref=e54]:
              - button "1 Team Member Details" [ref=e55]:
                - generic [ref=e56]: "1"
                - generic [ref=e57]: Team Member Details
              - button "2 Declaration Details" [ref=e58]:
                - generic [ref=e59]: "2"
                - generic [ref=e60]: Declaration Details
              - button "3 Gift, Hospitality or Entertainment Details" [ref=e61]:
                - generic [ref=e62]: "3"
                - generic [ref=e63]: Gift, Hospitality or Entertainment Details
              - button "4 Supporting Documents" [ref=e64]:
                - generic [ref=e65]: "4"
                - generic [ref=e66]: Supporting Documents
              - button "5 Declaration & Undertaking" [ref=e67]:
                - generic [ref=e68]: "5"
                - generic [ref=e69]: Declaration & Undertaking
          - generic [ref=e70]:
            - paragraph [ref=e71]: Definitions
            - generic [ref=e72]:
              - paragraph [ref=e73]: Gift
              - paragraph [ref=e74]: Anything of value including cash, vouchers, goods, services, preferential discounts or favours.
            - generic [ref=e75]:
              - paragraph [ref=e76]: Hospitality
              - paragraph [ref=e77]: Accommodation, travel, conferences, tickets or formal business functions.
            - generic [ref=e78]:
              - paragraph [ref=e79]: Entertainment
              - paragraph [ref=e80]: Meals, events, sporting, cultural or recreational activities.
          - generic [ref=e81]:
            - paragraph [ref=e82]: Related Policies
            - generic [ref=e83]:
              - img [ref=e84]
              - paragraph [ref=e87]: Gifts, Hospitality & Entertainment Policy
            - generic [ref=e88]:
              - img [ref=e89]
              - paragraph [ref=e92]: Anti-Bribery and Corruption Policy
        - generic [ref=e93]:
          - generic [ref=e95]:
            - heading "New Declaration" [level=1] [ref=e96]
            - paragraph [ref=e97]: Fields marked * are mandatory.
          - generic [ref=e98]:
            - generic [ref=e99]:
              - generic [ref=e100]: "1"
              - heading "Team Member Details" [level=3] [ref=e101]
            - generic [ref=e104]:
              - generic [ref=e105]:
                - generic [ref=e107]:
                  - generic [ref=e108]: Team Member Name
                  - generic [ref=e109]: "*"
                - textbox [ref=e110]: Lindiwe Zulu
              - generic [ref=e111]:
                - generic [ref=e114]: Team Member Code
                - textbox "e.g. HB-204478" [ref=e115]: HB-10002
              - generic [ref=e116]:
                - generic [ref=e118]:
                  - generic [ref=e119]: Manager Name
                  - generic [ref=e120]: "*"
                - textbox [ref=e121]
              - generic [ref=e122]:
                - generic [ref=e124]:
                  - generic [ref=e125]: Company
                  - generic [ref=e126]: "*"
                - textbox [ref=e127]: Hollywoodbets Group
              - generic [ref=e128]:
                - generic [ref=e130]:
                  - generic [ref=e131]: Department
                  - generic [ref=e132]: "*"
                - textbox [ref=e133]: HR
              - generic [ref=e134]:
                - generic [ref=e136]:
                  - generic [ref=e137]: Role / Position
                  - generic [ref=e138]: "*"
                - textbox [ref=e139]: Head of HR
          - generic [ref=e140]:
            - generic [ref=e141]:
              - generic [ref=e142]: "2"
              - heading "Declaration Details" [level=3] [ref=e143]
            - generic [ref=e146]:
              - generic [ref=e147]:
                - generic [ref=e148]:
                  - generic [ref=e150]:
                    - generic [ref=e151]: Did you receive or give a Gift, Hospitality or Entertainment?
                    - generic [ref=e152]: "*"
                  - combobox [ref=e154]:
                    - generic: Received
                    - img
                - generic [ref=e155]:
                  - generic [ref=e157]:
                    - generic [ref=e158]: Who did you receive a Gift, Hospitality or Entertainment from?
                    - generic [ref=e159]: "*"
                  - combobox [ref=e161]:
                    - generic: Select…
                    - img
              - generic [ref=e162]:
                - generic [ref=e163]:
                  - generic [ref=e164]:
                    - generic [ref=e165]: Name of the Supplier, Customer, Team Member or Public Official
                    - generic [ref=e166]: "*"
                  - paragraph [ref=e167]: Full name of the organisation or individual.
                - textbox "Full legal name" [ref=e168]
              - generic [ref=e169]:
                - generic [ref=e171]:
                  - generic [ref=e172]: Name of the person giving or receiving the gift at the Supplier or Customer, or name of the Public Official
                  - generic [ref=e173]: "*"
                - textbox "e.g. Ahmed Al-Rashid" [ref=e174]
              - generic [ref=e175]:
                - generic [ref=e176]:
                  - generic [ref=e178]:
                    - generic [ref=e179]: Are we currently negotiating a contract with the Supplier or Customer?
                    - generic [ref=e180]: "*"
                  - combobox [ref=e181]:
                    - generic: Select…
                    - img
                - generic [ref=e182]:
                  - generic [ref=e184]:
                    - generic [ref=e185]: Is the Supplier or Potential Supplier involved in a bidding process with us?
                    - generic [ref=e186]: "*"
                  - combobox [ref=e187]:
                    - generic: Select…
                    - img
                - generic [ref=e188]:
                  - generic [ref=e190]:
                    - generic [ref=e191]: Is there an existing or imminent business relationship with the Supplier or Customer?
                    - generic [ref=e192]: "*"
                  - combobox [ref=e193]:
                    - generic: Select…
                    - img
          - generic [ref=e194]:
            - generic [ref=e195]:
              - generic [ref=e196]: "3"
              - heading "Gift, Hospitality or Entertainment Details" [level=3] [ref=e197]
            - generic [ref=e200]:
              - generic [ref=e201]:
                - generic [ref=e203]:
                  - generic [ref=e204]: What category does the nature of the gift fall into?
                  - generic [ref=e205]: "*"
                - combobox [ref=e206]:
                  - generic: Select category…
                  - img
              - generic [ref=e207]:
                - generic [ref=e209]:
                  - generic [ref=e210]: Please describe the nature of the gift in detail
                  - generic [ref=e211]: "*"
                - textbox "e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200." [ref=e212]
                - paragraph [ref=e213]: 0/5000
              - generic [ref=e214]:
                - generic [ref=e215]:
                  - generic [ref=e218]: Reason/Occasion for the gift
                  - combobox [ref=e219]:
                    - generic: Select reason…
                    - img
                - generic [ref=e220]:
                  - generic [ref=e222]:
                    - generic [ref=e223]: Date of Gift
                    - generic [ref=e224]: "*"
                  - textbox [ref=e225]
              - generic [ref=e226]:
                - generic [ref=e228]:
                  - generic [ref=e229]: Number of instances a gift has been given/received between you and this party in the past 12 months
                  - generic [ref=e230]: "*"
                - combobox [ref=e231]:
                  - generic: Select…
                  - img
              - generic [ref=e232]:
                - generic [ref=e233]:
                  - generic [ref=e235]: Rand Value or Equivalent Rand Value (including VAT)
                  - paragraph [ref=e236]: Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.
                - generic [ref=e237]:
                  - generic: R
                  - textbox "0.00" [ref=e238]
          - generic [ref=e239]:
            - generic [ref=e240]:
              - generic [ref=e241]: "4"
              - heading "Supporting Documents" [level=3] [ref=e242]
            - generic [ref=e244]:
              - button "Choose File" [ref=e245]
              - generic [ref=e246] [cursor=pointer]:
                - img [ref=e248]
                - paragraph [ref=e251]: Drag & drop files here, or click to browse
                - paragraph [ref=e252]: PDF (preferred), PNG, JPG, DOCX — max 20 MB each
              - paragraph [ref=e253]: Upload invoices, receipts, photos, or event invitations that support this declaration.
          - generic [ref=e254]:
            - generic [ref=e255]:
              - generic [ref=e256]: "5"
              - heading "Declaration & Undertaking" [level=3] [ref=e257]
            - generic [ref=e259]:
              - paragraph [ref=e260]: "By submitting this declaration I undertake and confirm that:"
              - generic [ref=e261]:
                - generic [ref=e262]:
                  - img [ref=e264]
                  - paragraph [ref=e266]: My objectivity and impartiality has not been impacted by receiving or giving of the Gift, Hospitality or Entertainment.
                - generic [ref=e267]:
                  - img [ref=e269]
                  - paragraph [ref=e271]: The execution of my duties has not been influenced and will not be influenced.
                - generic [ref=e272]:
                  - img [ref=e274]
                  - paragraph [ref=e276]: I have complied with the Anti-Bribery and Corruption Policy.
                - generic [ref=e277]:
                  - img [ref=e279]
                  - paragraph [ref=e281]: I have complied with the Gifts, Hospitality and Entertainment Policy.
                - generic [ref=e282]:
                  - img [ref=e284]
                  - paragraph [ref=e286]: No conflict of interest or perceived conflict of interest has been created.
                - generic [ref=e287]:
                  - img [ref=e289]
                  - paragraph [ref=e291]: The information provided is valid, accurate and complete.
              - generic [ref=e293]:
                - button "Clear Form" [ref=e294]
                - generic [ref=e295]:
                  - button "Save Draft" [ref=e296]
                  - button "Submit Declaration" [ref=e297]:
                    - img [ref=e298]
                    - text: Submit Declaration
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
> 93  |     await expect(this.page.locator('label:has-text("Team Member Name") + input')).toHaveValue(teamMember, { timeout: 10000 });
      |     ^ ReferenceError: expect is not defined
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