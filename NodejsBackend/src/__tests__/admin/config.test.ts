import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "../helpers";

const app = buildApp();

describe("Admin Config", () => {
  it("GET /api/admin/config — returns system config", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.highValueThreshold).toBe(2000);
    expect(res.body.slaEscalationDays).toBe(3);
  });

  it("PUT /api/admin/config — updates config", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: 5000, mediumValueThreshold: 500, slaEscalationDays: 5, maxDeclarationsPerCounterparty: 10, emailTemplate: "New template" });
    expect(res.status).toBe(200);
    expect(res.body.highValueThreshold).toBe(5000);
  });

  it("PUT /api/admin/config — rejects invalid body", async () => {
    const res = await request(app)
      .put("/api/admin/config")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ highValueThreshold: "not-a-number" });
    expect(res.status).toBe(400);
  });

  it("GET /api/admin/config/dropdowns — returns dropdowns", async () => {
    const res = await request(app)
      .get("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.departments).toContain("Marketing");
    expect(res.body.categories).toContain("Gift");
  });

  it("PUT /api/admin/config/dropdowns — updates dropdowns", async () => {
    const res = await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ departments: ["Marketing", "IT", "Finance"], categories: ["Gift", "Hospitality", "Entertainment"], occasions: ["Meeting"], receivedGiven: ["Received"], biddingProcess: ["Yes"], publicOfficial: ["No"], relationships: ["Yes"], partyTypes: ["Supplier"] });
    expect(res.status).toBe(200);
    expect(res.body.departments).toHaveLength(3);
  });

  it("PUT /api/admin/config/dropdowns — rejects empty array", async () => {
    const res = await request(app)
      .put("/api/admin/config/dropdowns")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ departments: [], categories: ["Gift"], occasions: ["M"], receivedGiven: ["R"], biddingProcess: ["Y"], publicOfficial: ["N"], relationships: ["Y"], partyTypes: ["S"] });
    expect(res.status).toBe(400);
  });

  it("GET /api/admin/config/approval-options — returns options", async () => {
    const res = await request(app)
      .get("/api/admin/config/approval-options")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(5);
    expect(res.body[0].value).toBe("accept");
  });

  it("Config endpoints — non-admin gets 403", async () => {
    const res = await request(app)
      .get("/api/admin/config")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(403);
  });
});
