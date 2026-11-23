import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "./helpers";
import { prisma } from "../config/prisma";
import { hashLocalPassword } from "../services/localAuth";

describe("local password recovery", () => {
  const app = buildApp();
  let emailBody = "";

  beforeAll(async () => {
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL, init?: RequestInit) => {
      emailBody = String(init?.body ?? "");
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }));
    await prisma.user.update({
      where: { id: 1n },
      data: {
        localAuthEnabled: true,
        isActive: true,
        passwordHash: await hashLocalPassword("RecoveryTestPassword!2026"),
        passwordEnrollmentRequired: false,
      },
    });
  });

  it("returns the same generic response for unknown and eligible employee IDs", async () => {
    const unknown = await request(app).post("/api/auth/local/forgot-password").send({ employeeId: "999999" });
    const known = await request(app).post("/api/auth/local/forgot-password").send({ employeeId: "1" });
    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    expect(unknown.body.message).toBe(known.body.message);
    expect(typeof unknown.body.challengeId).toBe("string");
    expect(typeof known.body.challengeId).toBe("string");
  });

  it("starts employee-ID login with an email OTP and masked email hint", async () => {
    const started = await request(app).post("/api/auth/local/start").send({ employeeId: "1", password: "RecoveryTestPassword!2026" });
    expect(started.status).toBe(202);
    expect(started.body.emailHint).toMatch(/^••••/);
    expect(emailBody).toContain("emailSubject");
    expect(emailBody).toContain("GHE employee sign-in verification code");
  });

  it("accepts the captured OTP once and returns a local session after reset", async () => {
    const started = await request(app).post("/api/auth/local/forgot-password").send({ employeeId: "1" });
    const message = JSON.parse(emailBody) as { emailBody: string };
    const code = message.emailBody.match(/code is (\d{6})/)?.[1] ?? "";
    const completed = await request(app).post("/api/auth/local/forgot-password/verify").send({
      challengeId: started.body.challengeId,
      code,
      newPassword: "RecoveryResetPassword!2026",
    });
    expect(completed.status).toBe(200);
    expect(typeof completed.body.accessToken).toBe("string");
    const replay = await request(app).post("/api/auth/local/forgot-password/verify").send({
      challengeId: started.body.challengeId,
      code,
      newPassword: "RecoveryResetPassword!2026",
    });
    expect(replay.status).toBe(401);
  });
});
