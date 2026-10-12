import { describe, it, expect, vi, afterEach } from "vitest";
import request from "supertest";
import { execSync } from "node:child_process";
import { docsEnabled, assertNonProductionSeed } from "../config/env";

afterEach(() => {
  vi.unstubAllEnvs();
});

// Phase 7 production hardening: interactive API docs and demo-data seeding
// must never be available from a production deployment.
describe("production posture", () => {
  it("serves API docs outside production", () => {
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(docsEnabled()).toBe(true);
  });

  it("disables API docs in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(docsEnabled()).toBe(false);
  });

  it("allows seeding outside production", () => {
    expect(() => assertNonProductionSeed()).not.toThrow();
  });

  it("refuses seeding in production without an explicit override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GHE_ALLOW_PROD_SEED", "");
    expect(() => assertNonProductionSeed()).toThrow(/Refusing to seed/);
  });

  it("allows seeding in production only with the explicit override", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("GHE_ALLOW_PROD_SEED", "1");
    expect(() => assertNonProductionSeed()).not.toThrow();
  });

  it("seed entrypoint refuses before touching the database in production", () => {    // A bogus DATABASE_URL proves the refusal happens before any database
    // work: a late guard would fail with a Prisma connection error instead.
    let output = "";
    try {
      output = execSync("npx tsx src/seed.ts", {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          DATABASE_URL: "postgresql://invalid:invalid@127.0.0.1:1/refused",
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 90000,
      });
    } catch (err) {
      const e = err as { stdout?: unknown; stderr?: unknown };
      output = `${String(e.stdout ?? "")}\n${String(e.stderr ?? "")}`;
    }
    expect(output).toMatch(/Refusing to seed/);
  }, 120000);
});

// The limiters live on the production app (src/index.ts), not the bare
// test harness — boot the real wiring with tight env budgets and prove the
// behavior (429), not just the configuration.
describe("production wiring", () => {
  it("serves API docs from the production app outside production", async () => {
    vi.resetModules();
    const { createApp } = await import("../index");
    const res = await request(createApp()).get("/api/docs/");
    expect([200, 301]).toContain(res.status);
  });

  it("throttles abusive clients with 429", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "3");
    vi.stubEnv("RATE_LIMIT_AUTH_MAX", "1000");
    vi.resetModules();
    const { createApp } = await import("../index");
    const app = createApp();
    for (let i = 0; i < 3; i++) {
      const ok = await request(app).get("/api/health");
      expect(ok.status).toBe(200);
    }
    const limited = await request(app).get("/api/health");
    expect(limited.status).toBe(429);
  });

  it("throttles the auth path independently", async () => {
    vi.stubEnv("RATE_LIMIT_MAX", "1000");
    vi.stubEnv("RATE_LIMIT_AUTH_MAX", "2");
    vi.resetModules();
    const { createApp } = await import("../index");
    const app = createApp();
    await request(app).get("/api/auth/me");
    await request(app).get("/api/auth/me");
    const limited = await request(app).get("/api/auth/me");
    expect(limited.status).toBe(429);
  });
});
