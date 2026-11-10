import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getTeamToken, testToken } from "./helpers";

const app = buildApp();
const prisma = new PrismaClient();

// Token-validation contract (OpenID Phase 5): every malformed-identity case
// fails closed at the middleware, before any route logic runs.
describe("Bearer token validation contract", () => {
  it("missing header returns 401", async () => {
    const res = await request(app).get("/api/declarations");
    expect(res.status).toBe(401);
  });

  it("malformed token returns 401", async () => {
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", "Bearer not-a-token");
    expect(res.status).toBe(401);
  });

  it("wrong issuer returns 401", async () => {
    const token = testToken({
      oid: "test-oid-nomvula",
      email: "nomvula@test.com",
      name: "Nomvula Team",
      iss: "https://login.evil.example/tenant",
    });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("wrong audience returns 401", async () => {
    const token = testToken({
      oid: "test-oid-nomvula",
      email: "nomvula@test.com",
      name: "Nomvula Team",
      aud: "some-other-api",
    });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("non-RS256 algorithm returns 401", async () => {
    const token = testToken({
      oid: "test-oid-nomvula",
      email: "nomvula@test.com",
      name: "Nomvula Team",
      algHS256: true,
    });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it.each([
    ["untrusted client", { azp: "another-spa-id" }],
    ["missing client claim", { noAzp: true }],
    ["missing delegated scope", { scp: "profile email" }],
  ])("rejects token with %s", async (_label, claims) => {
    const token = testToken({ oid: "test-oid-nomvula", email: "nomvula@test.com", ...claims });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("expired token returns 401", async () => {
    const token = testToken({
      oid: "test-oid-nomvula",
      email: "nomvula@test.com",
      name: "Nomvula Team",
      expOffsetSec: -30,
    });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it.each(["noExp", "noIat"] as const)("token missing %s returns 401", async (claim) => {
    const token = testToken({ oid: "test-oid-nomvula", email: "nomvula@test.com", [claim]: true });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("missing object identifier returns 401", async () => {
    const token = testToken({ email: "nomvula@test.com", name: "Nomvula Team", noOid: true });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it("valid token for an unprovisioned user auto-provisions a least-privilege account", async () => {
    const token = testToken({ oid: "test-oid-stranger", email: "stranger@x.test", name: "Stranger" });
    const res = await request(app)
      .get("/api/declarations")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

describe("Provider-identity binding (docs/IDENTITY-CONTRACT.md)", () => {
  // Dedicated users: adoption mutates rows, so fixture users are off-limits.
  beforeAll(async () => {
    await prisma.user.upsert({
      where: { email: "authbind-a@test.com" },
      update: { providerSubject: null },
      create: {
        name: "Auth Bind A", email: "authbind-a@test.com", role: "teamMember",
        teamMemberNumber: "AB-001", position: "Tester",
      },
    });
    await prisma.user.upsert({
      where: { email: "authbind-b@test.com" },
      update: { providerSubject: null },
      create: {
        name: "Auth Bind B", email: "authbind-b@test.com", role: "teamMember",
        teamMemberNumber: "AB-002", position: "Tester",
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: ["authbind-a@test.com", "authbind-b@test.com"] } } });
    await prisma.$disconnect();
  });

  it("an unlinked provisioned account is denied; email cannot create an identity link", async () => {
    const token = testToken({ oid: "test-oid-adopt-me", email: "authbind-a@test.com", name: "Auth Bind A" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    const row = await prisma.user.findUnique({ where: { email: "authbind-a@test.com" }, select: { providerSubject: true } });
    expect(row?.providerSubject).toBeNull();
  });

  it("a different subject for a linked email fails closed with 403", async () => {
    await prisma.user.update({ where: { email: "authbind-b@test.com" }, data: { providerSubject: "test-oid-original-owner", providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439" } });
    const first = testToken({ oid: "test-oid-original-owner", email: "authbind-b@test.com", name: "Auth Bind B" });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${first}`)).status).toBe(200);
    const impostor = testToken({ oid: "test-oid-impostor", email: "authbind-b@test.com", name: "Auth Bind B" });
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${impostor}`);
    expect(res.status).toBe(403);
  });

  it("resolves a linked account by subject even if the provider email changes", async () => {
    await prisma.user.update({ where: { email: "authbind-b@test.com" }, data: { providerSubject: "test-oid-original-owner", providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439" } });
    const token = testToken({ oid: "test-oid-original-owner", email: "renamed-at-provider@test.com", name: "Changed Provider Name" });
    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("authbind-b@test.com");
  });

  it("disabled provisioned users are denied even with a matching provider link", async () => {
    await prisma.user.update({ where: { email: "authbind-b@test.com" }, data: { providerSubject: "test-oid-original-owner", providerIssuer: process.env.OIDC_ISSUER || "http://127.0.0.1:55439" } });
    await prisma.user.update({ where: { email: "authbind-b@test.com" }, data: { isActive: false } });
    try {
      const token = testToken({ oid: "test-oid-original-owner", email: "authbind-b@test.com", name: "Auth Bind B" });
      const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/disabled/i);
    } finally {
      await prisma.user.update({ where: { email: "authbind-b@test.com" }, data: { isActive: true } });
    }
  });
});

describe("Authorization still resolves roles from the database", () => {
  it("team member token cannot reach admin routes (403, not 401)", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
