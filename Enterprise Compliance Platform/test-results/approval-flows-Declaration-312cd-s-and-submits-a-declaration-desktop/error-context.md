# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Declaration Creation >> Team member creates and submits a declaration
- Location: e2e\approval-flows.spec.ts:115:3

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
        - button "New Declaration" [active] [ref=e14]:
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
                  - generic [ref=e111]: Manager Name
                  - generic [ref=e112]: "*"
                - textbox [ref=e113]
              - generic [ref=e114]:
                - generic [ref=e116]:
                  - generic [ref=e117]: Company
                  - generic [ref=e118]: "*"
                - textbox [ref=e119]: Hollywoodbets Group
              - generic [ref=e120]:
                - generic [ref=e122]:
                  - generic [ref=e123]: Department
                  - generic [ref=e124]: "*"
                - textbox [ref=e125]: Marketing
              - generic [ref=e126]:
                - generic [ref=e128]:
                  - generic [ref=e129]: Role / Position
                  - generic [ref=e130]: "*"
                - textbox [ref=e131]: Senior Brand Manager
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
                    - generic: Received
                    - img
                - generic [ref=e147]:
                  - generic [ref=e149]:
                    - generic [ref=e150]: Who did you receive a Gift, Hospitality or Entertainment from?
                    - generic [ref=e151]: "*"
                  - combobox [ref=e153]:
                    - generic: Select…
                    - img
              - generic [ref=e154]:
                - generic [ref=e155]:
                  - generic [ref=e156]:
                    - generic [ref=e157]: Name of the Supplier, Customer, Team Member or Public Official
                    - generic [ref=e158]: "*"
                  - paragraph [ref=e159]: Full name of the organisation or individual.
                - textbox "Full legal name" [ref=e160]
              - generic [ref=e161]:
                - generic [ref=e163]:
                  - generic [ref=e164]: Name of the person giving or receiving the gift at the Supplier or Customer, or name of the Public Official
                  - generic [ref=e165]: "*"
                - textbox "e.g. Ahmed Al-Rashid" [ref=e166]
              - generic [ref=e167]:
                - generic [ref=e168]:
                  - generic [ref=e170]:
                    - generic [ref=e171]: Are we currently negotiating a contract with the Supplier or Customer?
                    - generic [ref=e172]: "*"
                  - combobox [ref=e173]:
                    - generic: Select…
                    - img
                - generic [ref=e174]:
                  - generic [ref=e176]:
                    - generic [ref=e177]: Is the Supplier or Potential Supplier involved in a bidding process with us?
                    - generic [ref=e178]: "*"
                  - combobox [ref=e179]:
                    - generic: Select…
                    - img
                - generic [ref=e180]:
                  - generic [ref=e182]:
                    - generic [ref=e183]: Is there an existing or imminent business relationship with the Supplier or Customer?
                    - generic [ref=e184]: "*"
                  - combobox [ref=e185]:
                    - generic: Select…
                    - img
          - generic [ref=e186]:
            - generic [ref=e187]:
              - generic [ref=e188]: "3"
              - heading "Gift, Hospitality or Entertainment Details" [level=3] [ref=e189]
            - generic [ref=e192]:
              - generic [ref=e193]:
                - generic [ref=e195]:
                  - generic [ref=e196]: What category does the nature of the gift fall into?
                  - generic [ref=e197]: "*"
                - combobox [ref=e198]:
                  - generic: Select category…
                  - img
              - generic [ref=e199]:
                - generic [ref=e201]:
                  - generic [ref=e202]: Please describe the nature of the gift in detail
                  - generic [ref=e203]: "*"
                - textbox "e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200." [ref=e204]
                - paragraph [ref=e205]: 0/5000
              - generic [ref=e206]:
                - generic [ref=e207]:
                  - generic [ref=e210]: Reason/Occasion for the gift
                  - combobox [ref=e211]:
                    - generic: Select reason…
                    - img
                - generic [ref=e212]:
                  - generic [ref=e214]:
                    - generic [ref=e215]: Date of Gift
                    - generic [ref=e216]: "*"
                  - textbox [ref=e217]
              - generic [ref=e218]:
                - generic [ref=e220]:
                  - generic [ref=e221]: Number of instances a gift has been given/received between you and this party in the past 12 months
                  - generic [ref=e222]: "*"
                - combobox [ref=e223]:
                  - generic: Select…
                  - img
              - generic [ref=e224]:
                - generic [ref=e225]:
                  - generic [ref=e227]: Rand Value or Equivalent Rand Value (including VAT)
                  - paragraph [ref=e228]: Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.
                - generic [ref=e229]:
                  - generic: R
                  - textbox "0.00" [ref=e230]
          - generic [ref=e231]:
            - generic [ref=e232]:
              - generic [ref=e233]: "4"
              - heading "Supporting Documents" [level=3] [ref=e234]
            - generic [ref=e236]:
              - button "Choose File" [ref=e237]
              - generic [ref=e238] [cursor=pointer]:
                - img [ref=e240]
                - paragraph [ref=e243]: Drag & drop files here, or click to browse
                - paragraph [ref=e244]: PDF (preferred), PNG, JPG, DOCX — max 20 MB each
              - paragraph [ref=e245]: Upload invoices, receipts, photos, or event invitations that support this declaration.
          - generic [ref=e246]:
            - generic [ref=e247]:
              - generic [ref=e248]: "5"
              - heading "Declaration & Undertaking" [level=3] [ref=e249]
            - generic [ref=e251]:
              - paragraph [ref=e252]: "By submitting this declaration I undertake and confirm that:"
              - generic [ref=e253]:
                - generic [ref=e254]:
                  - img [ref=e256]
                  - paragraph [ref=e258]: My objectivity and impartiality has not been impacted by receiving or giving of the Gift, Hospitality or Entertainment.
                - generic [ref=e259]:
                  - img [ref=e261]
                  - paragraph [ref=e263]: The execution of my duties has not been influenced and will not be influenced.
                - generic [ref=e264]:
                  - img [ref=e266]
                  - paragraph [ref=e268]: I have complied with the Anti-Bribery and Corruption Policy.
                - generic [ref=e269]:
                  - img [ref=e271]
                  - paragraph [ref=e273]: I have complied with the Gifts, Hospitality and Entertainment Policy.
                - generic [ref=e274]:
                  - img [ref=e276]
                  - paragraph [ref=e278]: No conflict of interest or perceived conflict of interest has been created.
                - generic [ref=e279]:
                  - img [ref=e281]
                  - paragraph [ref=e283]: The information provided is valid, accurate and complete.
              - generic [ref=e285]:
                - button "Clear Form" [ref=e286]
                - generic [ref=e287]:
                  - button "Save Draft" [ref=e288]
                  - button "Submit Declaration" [ref=e289]:
                    - img [ref=e290]
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