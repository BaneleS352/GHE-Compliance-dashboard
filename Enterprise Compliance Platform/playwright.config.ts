import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:5173",
    headless: true,
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx tsx src/index.ts",
      cwd: "../NodejsBackend",
      port: 3001,
      timeout: 30000,
      reuseExistingServer: true,
      env: { JWT_SECRET: "test-secret" },
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "npx vite --port 5173 --strictPort",
      cwd: ".",
      port: 5173,
      timeout: 30000,
      reuseExistingServer: true,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
