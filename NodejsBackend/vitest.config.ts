import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./src/__tests__/globalSetup.ts"],
    testTimeout: 15000,
    maxWorkers: 1,
  },
});
