# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: approval-flows.spec.ts >> Admin — User Management >> Admin creates a new user
- Location: e2e\approval-flows.spec.ts:183:3

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
      - paragraph [ref=e12]: Administrator
      - generic [ref=e13]:
        - button "Dashboard" [ref=e14]:
          - img [ref=e15]
          - text: Dashboard
        - button "Users" [ref=e18]:
          - img [ref=e19]
          - text: Users
        - button "Workflows" [ref=e24]:
          - img [ref=e25]
          - text: Workflows
        - button "Dropdowns" [ref=e27]:
          - img [ref=e28]
          - text: Dropdowns
        - button "Config" [ref=e29]:
          - img [ref=e30]
          - text: Config
        - button "Reports" [ref=e33]:
          - img [ref=e34]
          - text: Reports
        - button "Approval Options" [ref=e37]:
          - img [ref=e38]
          - text: Approval Options
  - generic [ref=e41]:
    - banner [ref=e42]:
      - generic [ref=e47]: Gift, Hospitality or Entertainment ("GHE") Declaration System
      - generic [ref=e48]:
        - generic [ref=e50]:
          - generic [ref=e51]: SA
          - generic [ref=e52]:
            - paragraph [ref=e53]: System Admin
            - paragraph [ref=e54]: Administrator
        - button [ref=e55]:
          - img [ref=e56]
    - main [ref=e59]:
      - generic [ref=e60]:
        - generic [ref=e61]:
          - generic [ref=e62]:
            - heading "User Management" [level=1] [ref=e63]
            - paragraph [ref=e64]: Manage system users, roles, and permissions.
          - button "Add User" [active] [ref=e66]:
            - img [ref=e67]
            - text: Add User
        - generic [ref=e68]:
          - generic [ref=e69]:
            - img [ref=e70]
            - textbox "Search by name, email, or ID..." [ref=e73]
          - combobox [ref=e74] [cursor=pointer]:
            - option "All Roles" [selected]
            - option "Team Member"
            - option "Approver"
            - option "Administrator"
        - table [ref=e76]:
          - rowgroup [ref=e77]:
            - row "User ID Name Email Role Department Status Actions" [ref=e78]:
              - columnheader "User ID" [ref=e79]
              - columnheader "Name" [ref=e80]
              - columnheader "Email" [ref=e81]
              - columnheader "Role" [ref=e82]
              - columnheader "Department" [ref=e83]
              - columnheader "Status" [ref=e84]
              - columnheader "Actions" [ref=e85]
          - rowgroup [ref=e86]:
            - row "user-8 Ayanda Khumalo ayanda@hb.co.za Team Member Operations Active" [ref=e87]:
              - cell "user-8" [ref=e88]
              - cell "Ayanda Khumalo" [ref=e89]
              - cell "ayanda@hb.co.za" [ref=e90]
              - cell "Team Member" [ref=e91]:
                - generic [ref=e92]: Team Member
              - cell "Operations" [ref=e93]
              - cell "Active" [ref=e94]
              - cell [ref=e95]:
                - generic [ref=e96]:
                  - button [ref=e97]:
                    - img [ref=e98]
                  - button [ref=e101]:
                    - img [ref=e102]
            - row "user-10 Bongani Cele bongani@hb.co.za Team Member IT Active" [ref=e105]:
              - cell "user-10" [ref=e106]
              - cell "Bongani Cele" [ref=e107]
              - cell "bongani@hb.co.za" [ref=e108]
              - cell "Team Member" [ref=e109]:
                - generic [ref=e110]: Team Member
              - cell "IT" [ref=e111]
              - cell "Active" [ref=e112]
              - cell [ref=e113]:
                - generic [ref=e114]:
                  - button [ref=e115]:
                    - img [ref=e116]
                  - button [ref=e119]:
                    - img [ref=e120]
            - row "USR-1785338914242-6531 E2E User 1785338913881 e2e-1785338913881@hb.co.za Approver Marketing Active" [ref=e123]:
              - cell "USR-1785338914242-6531" [ref=e124]
              - cell "E2E User 1785338913881" [ref=e125]
              - cell "e2e-1785338913881@hb.co.za" [ref=e126]
              - cell "Approver" [ref=e127]:
                - generic [ref=e128]: Approver
              - cell "Marketing" [ref=e129]
              - cell "Active" [ref=e130]
              - cell [ref=e131]:
                - generic [ref=e132]:
                  - button [ref=e133]:
                    - img [ref=e134]
                  - button [ref=e137]:
                    - img [ref=e138]
            - row "USR-1785338923436-2895 E2E User 1785338923035 e2e-1785338923035@hb.co.za Approver Marketing Active" [ref=e141]:
              - cell "USR-1785338923436-2895" [ref=e142]
              - cell "E2E User 1785338923035" [ref=e143]
              - cell "e2e-1785338923035@hb.co.za" [ref=e144]
              - cell "Approver" [ref=e145]:
                - generic [ref=e146]: Approver
              - cell "Marketing" [ref=e147]
              - cell "Active" [ref=e148]
              - cell [ref=e149]:
                - generic [ref=e150]:
                  - button [ref=e151]:
                    - img [ref=e152]
                  - button [ref=e155]:
                    - img [ref=e156]
            - row "USR-1785339626741-4870 E2E User 1785339626337 e2e-1785339626337@hb.co.za Approver Marketing Active" [ref=e159]:
              - cell "USR-1785339626741-4870" [ref=e160]
              - cell "E2E User 1785339626337" [ref=e161]
              - cell "e2e-1785339626337@hb.co.za" [ref=e162]
              - cell "Approver" [ref=e163]:
                - generic [ref=e164]: Approver
              - cell "Marketing" [ref=e165]
              - cell "Active" [ref=e166]
              - cell [ref=e167]:
                - generic [ref=e168]:
                  - button [ref=e169]:
                    - img [ref=e170]
                  - button [ref=e173]:
                    - img [ref=e174]
            - row "USR-1785339636006-5419 E2E User 1785339635538 e2e-1785339635538@hb.co.za Approver Marketing Active" [ref=e177]:
              - cell "USR-1785339636006-5419" [ref=e178]
              - cell "E2E User 1785339635538" [ref=e179]
              - cell "e2e-1785339635538@hb.co.za" [ref=e180]
              - cell "Approver" [ref=e181]:
                - generic [ref=e182]: Approver
              - cell "Marketing" [ref=e183]
              - cell "Active" [ref=e184]
              - cell [ref=e185]:
                - generic [ref=e186]:
                  - button [ref=e187]:
                    - img [ref=e188]
                  - button [ref=e191]:
                    - img [ref=e192]
            - row "USR-1785391135105-2290 E2E User 1785391134800 e2e-1785391134800@hb.co.za Approver Marketing Active" [ref=e195]:
              - cell "USR-1785391135105-2290" [ref=e196]
              - cell "E2E User 1785391134800" [ref=e197]
              - cell "e2e-1785391134800@hb.co.za" [ref=e198]
              - cell "Approver" [ref=e199]:
                - generic [ref=e200]: Approver
              - cell "Marketing" [ref=e201]
              - cell "Active" [ref=e202]
              - cell [ref=e203]:
                - generic [ref=e204]:
                  - button [ref=e205]:
                    - img [ref=e206]
                  - button [ref=e209]:
                    - img [ref=e210]
            - row "USR-1785391143118-5716 E2E User 1785391142851 e2e-1785391142851@hb.co.za Approver Marketing Active" [ref=e213]:
              - cell "USR-1785391143118-5716" [ref=e214]
              - cell "E2E User 1785391142851" [ref=e215]
              - cell "e2e-1785391142851@hb.co.za" [ref=e216]
              - cell "Approver" [ref=e217]:
                - generic [ref=e218]: Approver
              - cell "Marketing" [ref=e219]
              - cell "Active" [ref=e220]
              - cell [ref=e221]:
                - generic [ref=e222]:
                  - button [ref=e223]:
                    - img [ref=e224]
                  - button [ref=e227]:
                    - img [ref=e228]
            - row "user-11 Fatima Ismail fatima@hb.co.za Team Member Legal Active" [ref=e231]:
              - cell "user-11" [ref=e232]
              - cell "Fatima Ismail" [ref=e233]
              - cell "fatima@hb.co.za" [ref=e234]
              - cell "Team Member" [ref=e235]:
                - generic [ref=e236]: Team Member
              - cell "Legal" [ref=e237]
              - cell "Active" [ref=e238]
              - cell [ref=e239]:
                - generic [ref=e240]:
                  - button [ref=e241]:
                    - img [ref=e242]
                  - button [ref=e245]:
                    - img [ref=e246]
            - row "user-4 Lindiwe Zulu lindiwe@hb.co.za Approver HR Active" [ref=e249]:
              - cell "user-4" [ref=e250]
              - cell "Lindiwe Zulu" [ref=e251]
              - cell "lindiwe@hb.co.za" [ref=e252]
              - cell "Approver" [ref=e253]:
                - generic [ref=e254]: Approver
              - cell "HR" [ref=e255]
              - cell "Active" [ref=e256]
              - cell [ref=e257]:
                - generic [ref=e258]:
                  - button [ref=e259]:
                    - img [ref=e260]
                  - button [ref=e263]:
                    - img [ref=e264]
            - row "user-1 Nomvula Dlamini nomvula@hb.co.za Team Member Marketing Active" [ref=e267]:
              - cell "user-1" [ref=e268]
              - cell "Nomvula Dlamini" [ref=e269]
              - cell "nomvula@hb.co.za" [ref=e270]
              - cell "Team Member" [ref=e271]:
                - generic [ref=e272]: Team Member
              - cell "Marketing" [ref=e273]
              - cell "Active" [ref=e274]
              - cell [ref=e275]:
                - generic [ref=e276]:
                  - button [ref=e277]:
                    - img [ref=e278]
                  - button [ref=e281]:
                    - img [ref=e282]
            - row "user-7 Pieter van der Berg pieter@hb.co.za Team Member Finance Active" [ref=e285]:
              - cell "user-7" [ref=e286]
              - cell "Pieter van der Berg" [ref=e287]
              - cell "pieter@hb.co.za" [ref=e288]
              - cell "Team Member" [ref=e289]:
                - generic [ref=e290]: Team Member
              - cell "Finance" [ref=e291]
              - cell "Active" [ref=e292]
              - cell [ref=e293]:
                - generic [ref=e294]:
                  - button [ref=e295]:
                    - img [ref=e296]
                  - button [ref=e299]:
                    - img [ref=e300]
            - row "user-5 Sandile Shabalala sandile@hb.co.za Approver Executive Active" [ref=e303]:
              - cell "user-5" [ref=e304]
              - cell "Sandile Shabalala" [ref=e305]
              - cell "sandile@hb.co.za" [ref=e306]
              - cell "Approver" [ref=e307]:
                - generic [ref=e308]: Approver
              - cell "Executive" [ref=e309]
              - cell "Active" [ref=e310]
              - cell [ref=e311]:
                - generic [ref=e312]:
                  - button [ref=e313]:
                    - img [ref=e314]
                  - button [ref=e317]:
                    - img [ref=e318]
            - row "user-12 Siphamandla Ndlovu siphamandla@hb.co.za Team Member Marketing Active" [ref=e321]:
              - cell "user-12" [ref=e322]
              - cell "Siphamandla Ndlovu" [ref=e323]
              - cell "siphamandla@hb.co.za" [ref=e324]
              - cell "Team Member" [ref=e325]:
                - generic [ref=e326]: Team Member
              - cell "Marketing" [ref=e327]
              - cell "Active" [ref=e328]
              - cell [ref=e329]:
                - generic [ref=e330]:
                  - button [ref=e331]:
                    - img [ref=e332]
                  - button [ref=e335]:
                    - img [ref=e336]
            - row "user-3 Sipho Nkosi sipho@hb.co.za Approver Marketing Active" [ref=e339]:
              - cell "user-3" [ref=e340]
              - cell "Sipho Nkosi" [ref=e341]
              - cell "sipho@hb.co.za" [ref=e342]
              - cell "Approver" [ref=e343]:
                - generic [ref=e344]: Approver
              - cell "Marketing" [ref=e345]
              - cell "Active" [ref=e346]
              - cell [ref=e347]:
                - generic [ref=e348]:
                  - button [ref=e349]:
                    - img [ref=e350]
                  - button [ref=e353]:
                    - img [ref=e354]
            - row "user-6 System Admin admin@hb.co.za Administrator IT Active" [ref=e357]:
              - cell "user-6" [ref=e358]
              - cell "System Admin" [ref=e359]
              - cell "admin@hb.co.za" [ref=e360]
              - cell "Administrator" [ref=e361]:
                - generic [ref=e362]: Administrator
              - cell "IT" [ref=e363]
              - cell "Active" [ref=e364]
              - cell [ref=e365]:
                - generic [ref=e366]:
                  - button [ref=e367]:
                    - img [ref=e368]
                  - button [ref=e371]:
                    - img [ref=e372]
            - row "user-2 Thabo Mokoena thabo@hb.co.za Team Member Sales Active" [ref=e375]:
              - cell "user-2" [ref=e376]
              - cell "Thabo Mokoena" [ref=e377]
              - cell "thabo@hb.co.za" [ref=e378]
              - cell "Team Member" [ref=e379]:
                - generic [ref=e380]: Team Member
              - cell "Sales" [ref=e381]
              - cell "Active" [ref=e382]
              - cell [ref=e383]:
                - generic [ref=e384]:
                  - button [ref=e385]:
                    - img [ref=e386]
                  - button [ref=e389]:
                    - img [ref=e390]
            - row "user-9 Zanele Sithole zanele@hb.co.za Team Member HR Active" [ref=e393]:
              - cell "user-9" [ref=e394]
              - cell "Zanele Sithole" [ref=e395]
              - cell "zanele@hb.co.za" [ref=e396]
              - cell "Team Member" [ref=e397]:
                - generic [ref=e398]: Team Member
              - cell "HR" [ref=e399]
              - cell "Active" [ref=e400]
              - cell [ref=e401]:
                - generic [ref=e402]:
                  - button [ref=e403]:
                    - img [ref=e404]
                  - button [ref=e407]:
                    - img [ref=e408]
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