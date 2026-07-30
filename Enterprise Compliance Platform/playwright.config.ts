import { defineConfig, devices } from "@playwright/test";

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
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../NodejsBackend",
      port: 3001,
      timeout: 30000,
      reuseExistingServer: true,
      env: { JWT_SECRET: "test-secret" },
    },
    {
      command: "npx vite --port 5173",
      cwd: ".",
      port: 5173,
      timeout: 30000,
      reuseExistingServer: true,
    },
  ],
});