import { test, expect } from "@playwright/test";
import { USERS, LOGIN_INDEX, AppPage, NewDeclarationPage } from "./common-helpers";

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try { localStorage.clear(); } catch { /* ignore */ }
  });
});

test.describe("Approval Workflow — Full Flow", () => {
  test("Full approval: LM → HR (high-value)", async ({ page }) => {
    const app = new AppPage(page);
    const declId = "GHE-2024-0047";

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.login(USERS.lindiwe.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.verifyStatus(declId, "Approved");
  });

  test("Rejection at HR step", async ({ page }) => {
    const app = new AppPage(page);
    const declId = "GHE-2024-0045";

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.login(USERS.lindiwe.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Declined");
    await app.submitDecision();

    await app.verifyStatus(declId, "Declined");
  });

  test("Return at HR step → resubmit → full approval", async ({ page }) => {
    const app = new AppPage(page);
    const decl = new NewDeclarationPage(page);

    // Self-contained: Nomvula creates a high-value declaration (rule-2:
    // LM + HR), so the return/resubmit cycle never depends on seed state.
    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");
    await decl.autoFilled(USERS.nomvula.name, USERS.sipho.name);
    await decl.receivedGiven("Received");
    await decl.select("Who did you receive a Gift", "Supplier");
    await decl.fill("Name of the Supplier", "E2E Return Supplies");
    await decl.fill("Name of the person giving", "Return Contact");
    await decl.select("Are we currently negotiating", "No");
    await decl.select("Is the Supplier or potential Supplier", "No");
    await decl.select("Is there an existing or imminent", "No");
    await decl.select("What category does the nature", "Gift");
    await decl.textarea("E2E return-cycle gift");
    await decl.select("Reason/Occasion for the GHE", "Business Meeting");
    await decl.date("2026-07-15");
    await decl.number("Rand Value or Equivalent", "1500");
    await decl.substantiation("E2E return-cycle substantiation for high-value gift");
    await decl.submit();
    const declId = await decl.getId();
    expect(declId).toBeTruthy();
    await decl.closeModal();

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.login(USERS.lindiwe.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Return");
    await app.submitDecision();

    await app.verifyStatus(declId, "Returned");

    // Owner resubmits the returned declaration.
    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    await app.search(declId);
    await app.clickEditResubmitFor(declId);
    await decl.waitForDraftDescription("E2E return-cycle gift");
    await decl.submit();
    await decl.closeModal();

    // The LM approval is preserved across resubmission, so the declaration
    // returns straight to HR — no second LM round.
    await app.login(USERS.lindiwe.email);
    await app.sidebar("Approval Queue");
    await app.clickReviewFor(declId);
    await app.pickDecision("Accept");
    await app.submitDecision();

    await app.verifyStatus(declId, "Approved");
  });

  test("Team member views approved declaration timeline", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");
    await app.search("GHE-2025-0009");

    await app.page.locator("table button:has-text('View')").first().click();
    await app.page.waitForLoadState("networkidle");

    await app.assertVisible("h1:has-text(\"Approval Workflow\")");
    // Both seeded steps are decided: the timeline shows Approved badges.
    await app.assertVisible("text=1. Line Manager Approval");
    await app.assertVisible("text=2. Head of HR Approval");
  });
});

test.describe("Declaration Creation", () => {
  test("Team member creates and submits a declaration", async ({ page }) => {
    const app = new AppPage(page);
    const decl = new NewDeclarationPage(page);

    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");
    await decl.autoFilled(USERS.nomvula.name, USERS.sipho.name);
    await decl.receivedGiven("Given");
    await decl.select("Who did you give a Gift", "Supplier");
    await decl.fill("Name of the Supplier", "E2E Test Supplies");
    await decl.fill("Name of the person giving", "Test Contact");
    await decl.select("Are we currently negotiating", "No");
    await decl.select("Is the Supplier or potential Supplier", "No");
    await decl.select("Is there an existing or imminent", "No");
    await decl.select("What category does the nature", "Gift");
    await decl.textarea("E2E test gift for automated testing");
    await decl.select("Reason/Occasion for the GHE", "Business Meeting");
    await decl.date("2026-07-15");
    await decl.number("Rand Value or Equivalent", "100");
    await decl.submit();

    const declId = await decl.getId();
    expect(declId).toBeTruthy();
    await decl.closeModal();

    await app.login(USERS.sipho.email);
    await app.sidebar("Approval Queue");
    await app.search(declId);
    await app.assertVisible(`table td:has-text("${declId}")`);
    await app.assertVisible(`table td span:has-text("Pending")`);
  });

  test("Approver creates and submits a declaration (LM verifies)", async ({ page }) => {
    const app = new AppPage(page);
    const decl = new NewDeclarationPage(page);

    // Sipho (approver, HB) has Lindiwe as manager in seed data, so his
    // identity fields prefill and submission resolves an LM step.
    await app.login(USERS.sipho.email);
    await app.sidebar("New Declaration");
    await decl.autoFilled(USERS.sipho.name, USERS.lindiwe.name);
    await decl.receivedGiven("Received");
    await decl.select("Who did you receive a Gift", "Supplier");
    await decl.fill("Name of the Supplier", "E2E Approver Supplies");
    await decl.fill("Name of the person giving", "Approver Contact");
    await decl.select("Are we currently negotiating", "N/A");
    await decl.select("Is the Supplier or potential Supplier", "N/A");
    await decl.select("Is there an existing or imminent", "Yes");
    await decl.select("What category does the nature", "Hospitality");
    await decl.textarea("E2E test hospitality for approver flow");
    await decl.select("Reason/Occasion for the GHE", "Milestone");
    await decl.date("2026-07-15");
    await decl.number("Rand Value or Equivalent", "100");
    await decl.submit();

    const declId = await decl.getId();
    expect(declId).toBeTruthy();
    await decl.closeModal();

    await app.login(USERS.lindiwe.email);
    await app.sidebar("Approval Queue");
    await app.search(declId);
    await app.assertVisible(`table td:has-text("${declId}")`);
    await app.assertVisible(`table td span:has-text("Pending")`);
  });
});

test.describe("Admin — User Management", () => {
  test("Admin creates a new user", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Users");

    const ts = Date.now();
    const userName = `E2E User ${ts}`;
    const userEmail = `e2e-${ts}@hb.co.za`;

    // User creation uses the application-styled dialog (no native prompts).
    await app.page.getByRole("button", { name: "Add User" }).click();
    await app.page.getByLabel(/Name/).fill(userName);
    await app.page.getByLabel(/Email/).fill(userEmail);
    await app.page.getByLabel(/Organization/).selectOption({ index: 1 });
    await app.page.getByRole("button", { name: "Add user", exact: true }).click();

    await app.assertVisible(`table td:has-text("${userName}")`);
    await app.assertVisible(`table td:has-text("${userEmail}")`);
  });

  test("Admin sees all navigation items", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Dashboard");

    await app.assertVisible('aside nav button:has-text("Dashboard")');
    await app.assertVisible('aside nav button:has-text("Users")');
    await app.assertVisible('aside nav button:has-text("Workflows")');
    await app.assertVisible('aside nav button:has-text("Dropdown Options")');
    await app.assertVisible('aside nav button:has-text("Config")');
    await app.assertVisible('aside nav button:has-text("Reports")');
  });
});

test.describe("Dashboard", () => {
  test("Approver dashboard shows KPIs", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.sipho.email);
    await app.sidebar("Dashboard");

    await app.assertVisible("h1:has-text(\"Approver Dashboard\")");
    await app.assertVisible("text=Pending Queue");
  });
});

test.describe("Reports", () => {
  test("Admin accesses reports", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Reports");

    await app.assertVisible("h1:has-text(\"Reports\")", 5000);
  });

  test("Approver can generate status breakdown report", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.sipho.email);
    await app.sidebar("Reports");

    await app.assertVisible("h3:has-text(\"Status Breakdown\")", 5000);
  });

  test("Admin downloads a password-protected report export", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Reports");

    await page.getByRole("button", { name: "Export Excel", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Protect export" })).toBeVisible();
    const passwordInputs = await page.getByLabel(/password/i).all();
    await passwordInputs[0].fill("s3cret-download-pw");
    await passwordInputs[1].fill("s3cret-download-pw");
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await page.getByRole("button", { name: "Protect & Download", exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^protected-.*\.xlsx$/);
    const path = await download.path();
    expect(path).toBeTruthy();
  });
});

test.describe("Dashboard — Admin", () => {
  test("Admin visits Dashboard page", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Dashboard");

    await app.assertVisible("h1:has-text(\"Admin\"), h1:has-text(\"Dashboard\")");
  });
});

test.describe("Workflow — Admin Management", () => {
  test("Admin manages workflow rules", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.admin.email);
    await app.sidebar("Workflows");

    await app.assertVisible("h1:has-text(\"Approval Workflow\")", 5000);
  });
});

test.describe("Edge Cases & Error Handling", () => {
  test("Team member can view My Declarations tab", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.nomvula.email);
    await app.sidebar("My Declarations");

    await app.assertVisible("h1:has-text(\"My Declarations\")", 5000);
    await app.assertVisible("table");
  });

  test("New declaration form pre-fills user fields", async ({ page }) => {
    const app = new AppPage(page);
    const decl = new NewDeclarationPage(page);

    await app.login(USERS.nomvula.email);
    await app.sidebar("New Declaration");
    await decl.autoFilled(USERS.nomvula.name, USERS.sipho.name);
  });

  test("Approver dashboard has Approval Queue link", async ({ page }) => {
    const app = new AppPage(page);

    await app.login(USERS.sipho.email);
    await app.sidebar("Dashboard");

    await expect(app.page.getByRole("button", { name: "Approval Queue", exact: true }).first()).toBeVisible();
  });
});
