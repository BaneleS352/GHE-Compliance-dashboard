import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./helpers";
import { prisma } from "../config/prisma";
import { hashLocalPassword } from "../services/localAuth";

describe("local password recovery", () => {
  const app = buildApp();

  beforeAll(async () => {
    await prisma.user.update({
      where: { id: 1n },
      data: {
        localAuthEnabled: true,
        isActive: true,
        phoneNumber: "+15550000001",
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

  it("accepts the captured OTP once and returns a local session after reset", async () => {
    const started = await request(app).post("/api/auth/local/forgot-password").send({ employeeId: "1" });
    const inbox = await request(app).get("/api/auth/local/inbox");
    const message = inbox.body[inbox.body.length - 1];
    const completed = await request(app).post("/api/auth/local/forgot-password/verify").send({
      challengeId: started.body.challengeId,
      code: message.code,
      newPassword: "RecoveryResetPassword!2026",
    });
    expect(completed.status).toBe(200);
    expect(typeof completed.body.accessToken).toBe("string");
    const replay = await request(app).post("/api/auth/local/forgot-password/verify").send({
      challengeId: started.body.challengeId,
      code: message.code,
      newPassword: "RecoveryResetPassword!2026",
    });
    expect(replay.status).toBe(401);
  });
});
