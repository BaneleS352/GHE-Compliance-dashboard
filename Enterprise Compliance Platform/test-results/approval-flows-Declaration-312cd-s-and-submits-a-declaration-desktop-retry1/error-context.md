# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Declaration Creation >> Team member creates and submits a declaration
- Location: e2e\approval-flows.spec.ts:109:3

# Error details

```
TimeoutError: locator.fill: Timeout 15000ms exceeded.
Call log:
  - waiting for locator('label:has-text("Rand Value or Equivalent") + input')

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
          - complementary [ref=e43]:
            - generic [ref=e44]:
              - paragraph [ref=e45]: Sections
              - navigation [ref=e46]:
                - button "1 Team Member Details" [ref=e47]:
                  - generic [ref=e48]: "1"
                  - generic [ref=e49]: Team Member Details
                - button "2 Declaration Details" [ref=e50]:
                  - generic [ref=e51]: "2"
                  - generic [ref=e52]: Declaration Details
                - button "3 Gift, Hospitality or Entertainment Details" [ref=e53]:
                  - generic [ref=e54]: "3"
                  - generic [ref=e55]: Gift, Hospitality or Entertainment Details
                - button "4 Supporting Documents" [ref=e56]:
                  - generic [ref=e57]: "4"
                  - generic [ref=e58]: Supporting Documents
                - button "5 Declaration & Undertaking" [ref=e59]:
                  - generic [ref=e60]: "5"
                  - generic [ref=e61]: Declaration & Undertaking
            - generic [ref=e62]:
              - paragraph [ref=e63]: Definitions
              - generic [ref=e64]:
                - paragraph [ref=e65]: Gift
                - paragraph [ref=e66]: Anything of value including cash, vouchers, goods, services, preferential discounts or favours.
              - generic [ref=e67]:
                - paragraph [ref=e68]: Hospitality
                - paragraph [ref=e69]: Accommodation, travel, conferences, tickets or formal business functions.
              - generic [ref=e70]:
                - paragraph [ref=e71]: Entertainment
                - paragraph [ref=e72]: Meals, events, sporting, cultural or recreational activities.
            - generic [ref=e73]:
              - paragraph [ref=e74]: Related Policies
              - generic [ref=e75]:
                - img [ref=e76]
                - paragraph [ref=e79]: Gifts, Hospitality & Entertainment Policy
              - generic [ref=e80]:
                - img [ref=e81]
                - paragraph [ref=e84]: Anti-Bribery and Corruption Policy
          - generic [ref=e85]:
            - generic [ref=e87]:
              - heading "New Declaration" [level=1] [ref=e88]
              - paragraph [ref=e89]: Fields marked * are mandatory.
            - generic [ref=e90]:
              - generic [ref=e91]:
                - generic [ref=e92]: "1"
                - heading "Team Member Details" [level=3] [ref=e93]
              - generic [ref=e96]:
                - generic [ref=e97]:
                  - generic [ref=e99]:
                    - generic [ref=e100]: Team Member Name
                    - generic [ref=e101]: "*"
                  - textbox [ref=e102]: Nomvula Dlamini
                - generic [ref=e103]:
                  - generic [ref=e106]: Team Member Code
                  - textbox "e.g. HB-204478" [ref=e107]: HB-204478
                - generic [ref=e108]:
                  - generic [ref=e110]:
                    - generic [ref=e111]: Company
                    - generic [ref=e112]: "*"
                  - textbox "Company (from your profile)" [disabled] [ref=e113]: Hollywoodbets Group
                - generic [ref=e114]:
                  - generic [ref=e116]:
                    - generic [ref=e117]: Department
                    - generic [ref=e118]: "*"
                  - textbox "Department (from your profile)" [disabled] [ref=e119]: Marketing
                - generic [ref=e120]:
                  - generic [ref=e122]:
                    - generic [ref=e123]: Team Member Role/Position
                    - generic [ref=e124]: "*"
                  - textbox [ref=e125]: Senior Brand Manager
                - generic [ref=e126]:
                  - generic [ref=e128]:
                    - generic [ref=e129]: Approving Manager Name
                    - generic [ref=e130]: "*"
                  - textbox "Approving manager (from your profile)" [disabled] [ref=e131]: Sipho Nkosi
            - generic [ref=e132]:
              - generic [ref=e133]:
                - generic [ref=e134]: "2"
                - heading "Declaration Details" [level=3] [ref=e135]
              - generic [ref=e138]:
                - generic [ref=e139]:
                  - generic [ref=e140]:
                    - generic [ref=e142]:
                      - generic [ref=e143]: Did you receive or give a Gift, Hospitality or Entertainment?
                      - generic [ref=e144]: "*"
                    - combobox [ref=e146]:
                      - generic: Given
                      - img
                  - generic [ref=e147]:
                    - generic [ref=e149]:
                      - generic [ref=e150]: Who did you give a Gift, Hospitality or Entertainment to?
                      - generic [ref=e151]: "*"
                    - combobox [ref=e153]:
                      - generic: Supplier
                      - img
                - generic [ref=e154]:
                  - generic [ref=e155]:
                    - generic [ref=e156]:
                      - generic [ref=e157]: Name of the Supplier, Customer, Team Member or Public Official
                      - generic [ref=e158]: "*"
                    - paragraph [ref=e159]: Full Name of the organisation or Team Member
                  - textbox "Full legal name" [ref=e160]: E2E Test Supplies
                - generic [ref=e161]:
                  - generic [ref=e163]:
                    - generic [ref=e164]: Name of the person giving or receiving the GHE at the Supplier or Customer, or name of the Public Official
                    - generic [ref=e165]: "*"
                  - textbox "e.g. Ahmed Al-Rashid" [ref=e166]: Test Contact
                - generic [ref=e167]:
                  - generic [ref=e168]:
                    - generic [ref=e170]:
                      - generic [ref=e171]: Are we currently negotiating a contract with the Supplier or Customer?
                      - generic [ref=e172]: "*"
                    - combobox [ref=e173]:
                      - generic: "No"
                      - img
                  - generic [ref=e174]:
                    - generic [ref=e176]:
                      - generic [ref=e177]: Is the Supplier or Potential Supplier involved in a bidding process with us?
                      - generic [ref=e178]: "*"
                    - combobox [ref=e179]:
                      - generic: "No"
                      - img
                  - generic [ref=e180]:
                    - generic [ref=e182]:
                      - generic [ref=e183]: Is there an existing or imminent business relationship with the Supplier or Customer?
                      - generic [ref=e184]: "*"
                    - combobox [ref=e185]:
                      - generic: "No"
                      - img
            - generic [ref=e186]:
              - generic [ref=e187]:
                - generic [ref=e188]: "3"
                - heading "Gift, Hospitality or Entertainment Details" [level=3] [ref=e189]
              - generic [ref=e192]:
                - generic [ref=e193]:
                  - generic [ref=e195]:
                    - generic [ref=e196]: What category does the nature of the GHE fall into?
                    - generic [ref=e197]: "*"
                  - combobox [ref=e198]:
                    - generic: Gift
                    - img
                  - generic [ref=e199]:
                    - img [ref=e200]
                    - paragraph [ref=e202]:
                      - generic [ref=e203]: "Gift:"
                      - text: Anything of value, including cash, vouchers, goods, services, preferential discounts or favours.
                - generic [ref=e204]:
                  - generic [ref=e206]:
                    - generic [ref=e207]: Please describe the nature of the GHE in detail
                    - generic [ref=e208]: "*"
                  - textbox "e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200." [ref=e209]: E2E test gift for automated testing
                  - paragraph [ref=e210]: 35/5000
                - generic [ref=e211]:
                  - generic [ref=e212]:
                    - generic [ref=e215]: Reason/Occasion for the GHE
                    - combobox [ref=e216]:
                      - generic: Business Meeting
                      - img
                  - generic [ref=e217]:
                    - generic [ref=e219]:
                      - generic [ref=e220]: Date of GHE
                      - generic [ref=e221]: "*"
                    - textbox [active] [ref=e222]: 2026-07-15
                - generic [ref=e223]:
                  - generic [ref=e224]:
                    - generic [ref=e226]: Rand Value or Equivalent Rand Value (including VAT)
                    - paragraph [ref=e227]: Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.
                  - generic [ref=e228]:
                    - generic: R
                    - textbox "0.00" [ref=e229]
            - generic [ref=e230]:
              - generic [ref=e231]:
                - generic [ref=e232]: "4"
                - heading "Supporting Documents" [level=3] [ref=e233]
              - generic [ref=e235]:
                - button "Choose File" [ref=e236]
                - generic [ref=e237] [cursor=pointer]:
                  - img [ref=e239]
                  - paragraph [ref=e242]: Drag & drop files here, or click to browse
                  - paragraph [ref=e243]: PDF (preferred), PNG, JPG, DOCX — max 20 MB each
                - paragraph [ref=e244]: Upload invoices, receipts, photos, or event invitations that support this declaration.
            - generic [ref=e245]:
              - generic [ref=e246]:
                - generic [ref=e247]: "5"
                - heading "Declaration & Undertaking" [level=3] [ref=e248]
              - generic [ref=e250]:
                - paragraph [ref=e251]: "By submitting this declaration I undertake and confirm that:"
                - generic [ref=e252]:
                  - generic [ref=e253]:
                    - img [ref=e255]
                    - paragraph [ref=e257]: My objectivity and impartiality has not been impacted by receiving or giving of the Gift, Hospitality or Entertainment.
                  - generic [ref=e258]:
                    - img [ref=e260]
                    - paragraph [ref=e262]: The execution of my duties has not been influenced and will not be influenced.
                  - generic [ref=e263]:
                    - img [ref=e265]
                    - paragraph [ref=e267]: I have complied with the Anti-Bribery and Corruption Policy.
                  - generic [ref=e268]:
                    - img [ref=e270]
                    - paragraph [ref=e272]: I have complied with the Gifts, Hospitality and Entertainment Policy.
                  - generic [ref=e273]:
                    - img [ref=e275]
                    - paragraph [ref=e277]: No conflict of interest or perceived conflict of interest has been created.
                  - generic [ref=e278]:
                    - img [ref=e280]
                    - paragraph [ref=e282]: The information provided is valid, accurate and complete.
                - generic [ref=e283]:
                  - generic [ref=e284]: System configuration could not be loaded — default thresholds apply. Ask an administrator to check the configuration before submitting high-value declarations.
                  - generic [ref=e285]:
                    - button "Clear Form" [ref=e286]
                    - generic [ref=e287]:
                      - button "Save Draft" [ref=e288]
                      - button "Submit Declaration" [ref=e289]:
                        - img [ref=e290]
                        - text: Submit Declaration
  - region "Notifications alt+T"
```

# Test source

```ts
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
  58  |     await this.page.locator(`table tr:has(td:has-text("${id}")) button:has-text('Review')`).first().click();
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
> 127 |     await this.page.locator(`label:has-text("${label}") + input`).fill(value);
      |                                                                   ^ TimeoutError: locator.fill: Timeout 15000ms exceeded.
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