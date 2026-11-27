import { defineConfig, devices } from "@playwright/test";

const TEST_JWKS_URL = process.env.E2E_JWKS_URL || "http://127.0.0.1:55439";
const TEST_EMAIL_CAPTURE_URL = process.env.E2E_EMAIL_CAPTURE_URL || "http://127.0.0.1:55444";
const TEST_DATABASE_URL = process.env.E2E_PG_DATABASE_URL || process.env.DATABASE_URL || "";
const API_PORT = process.env.E2E_API_PORT || "3001";
const WEB_PORT = process.env.E2E_WEB_PORT || "5173";
const API_URL = `http://127.0.0.1:${API_PORT}`;
const WEB_URL = `http://localhost:${WEB_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: WEB_URL,
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
      // Table-driven flows are desktop UX; mobile card flows are covered
      // separately (see mobile-interactions.spec.ts).
      testIgnore: "mobile-interactions.spec.ts",
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      // Desktop table/admin/report flows are covered by their own specs;
      // mobile-only card journeys live in mobile-interactions.spec.ts.
      testMatch: "mobile-interactions.spec.ts",
    },
  ],
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../NodejsBackend",
      port: Number(API_PORT),
      timeout: 30000,
      reuseExistingServer: false,
      // The API validates bearer tokens against this throwaway provider
      // (booted by e2e/global-setup.ts); e2e specs mint per-user tokens
      // from it. Use the same isolated database global setup migrated and
      // seeded; otherwise the backend silently falls back to NodejsBackend/.env.
      env: {
        DATABASE_URL: TEST_DATABASE_URL,
        PORT: API_PORT,
        CORS_ORIGIN: WEB_URL,
        OIDC_AUTHORITY: TEST_JWKS_URL,
        OIDC_ISSUER: TEST_JWKS_URL,
        OIDC_AUDIENCE: "ghe-test-api-audience",
        OIDC_ALLOWED_CLIENT_IDS: "test-spa-client-id",
        OIDC_REQUIRED_SCOPE: "access_as_user",
        LOCAL_AUTH_ENABLED: "true",
        EMAIL_API: `${TEST_EMAIL_CAPTURE_URL}/messages`,
        AZURITE_CONNECTION_STRING: process.env.AZURITE_CONNECTION_STRING || "",
        AZURITE_CONTAINER: process.env.E2E_AZURITE_CONTAINER || "ghe-e2e",
      },
    },
    {
      command: `npx vite --port ${WEB_PORT}`,
      cwd: ".",
      port: Number(WEB_PORT),
      timeout: 30000,
      reuseExistingServer: false,
      env: {
        E2E_API_URL: API_URL,
        E2E_JWKS_URL: TEST_JWKS_URL,
        E2E_EMAIL_CAPTURE_URL: TEST_EMAIL_CAPTURE_URL,
        VITE_DEV_TEST_PROVIDER: "true",
        VITE_ENABLE_LOCAL_AUTH: "true",
      },
    },
  ],
});
