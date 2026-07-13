import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";

const app = buildApp();

describe("Reports", () => {
  it("GET /api/reports/status-breakdown — returns counts by status", async () => {
    const res = await request(app)
      .get("/api/reports/status-breakdown")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.Pending).toBeGreaterThanOrEqual(1);
    expect(res.body.Approved).toBeGreaterThanOrEqual(1);
  });

  it("GET /api/reports/status-breakdown — filters by department", async () => {
    const res = await request(app)
      .get("/api/reports/status-breakdown?department=Marketing")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).length).toBeGreaterThan(0);
  });

  it("GET /api/reports/sla — returns turnaround times", async () => {
    const res = await request(app)
      .get("/api/reports/sla")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].role).toBeDefined();
    expect(res.body[0].avg).toBeDefined();
    expect(res.body[0].count).toBeGreaterThan(0);
  });

  it("GET /api/reports/counterparty-concentration — returns grouped data", async () => {
    const res = await request(app)
      .get("/api/reports/counterparty-concentration")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].counterparty).toBeDefined();
    expect(res.body[0].totalValue).toBeDefined();
  });

  it("GET /api/reports/high-value — returns declarations above threshold", async () => {
    const res = await request(app)
      .get("/api/reports/high-value")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(0);
    for (const d of res.body) {
      expect(d.value).toBeGreaterThanOrEqual(2000);
    }
  });

  it("GET /api/reports/list — returns filtered list", async () => {
    const res = await request(app)
      .get("/api/reports/list?status=Pending")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    res.body.forEach((d: any) => expect(d.status).toBe("Pending"));
  });

  it("GET /api/reports/export — generates Excel file", async () => {
    const res = await request(app)
      .get("/api/reports/export")
      .set("Authorization", `Bearer ${getAdminToken()}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["content-disposition"]).toContain(".xlsx");
  });

  it("Reports endpoints — non-admin can access", async () => {
    const res = await request(app)
      .get("/api/reports/status-breakdown")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(res.status).toBe(200);
  });
});
