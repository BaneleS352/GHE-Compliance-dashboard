import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getTeamToken, getApproverToken } from "./helpers";

const app = buildApp();

const BASE = {
  employee: "Nomvula Team",
  employeeId: 4,
  teamMemberNumber: "TM-001",
  lineManager: "Sipho Approver",
  position: "Brand Manager",
  department: "Marketing",
  type: "Gift",
  counterparty: "QueueTest",
  value: 100,
  submitted: "2026-07-05",
  approver: "Sipho Approver",
  priority: "Low",
  description: "Queue contract test",
  relationship: "Supplier",
  receivedGiven: "Received",
  from: "Supplier",
  contactPerson: "T",
  biddingProcess: "No",
  occasion: "Business Meeting",
  date: "2026-07-05",
  instances: "1",
  publicOfficial: "No",
};

describe("Phase 2 — authoritative approval queue", () => {
  it("GET /api/workflows/queue returns items and total from the same source", async () => {
    const create = await request(app)
      .post("/api/declarations")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .send(BASE);
    expect(create.status).toBe(201);
    const id = create.body.id as string;
    const submit = await request(app)
      .patch(`/api/declarations/${id}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(submit.status).toBe(200);

    const queue = await request(app)
      .get("/api/workflows/queue")
      .set("Authorization", `Bearer ${getApproverToken()}`);
    expect(queue.status).toBe(200);
    expect(queue.body).toHaveProperty("items");
    expect(queue.body).toHaveProperty("total");
    expect(Array.isArray(queue.body.items)).toBe(true);
    expect(queue.body.total).toBe(queue.body.items.length);
    expect(queue.body.items.some((item: any) => item.declaration.id === id)).toBe(true);
  });

  it("queue total is zero for users with no actionable step", async () => {
    const queue = await request(app)
      .get("/api/workflows/queue")
      .set("Authorization", `Bearer ${getTeamToken()}`);
    expect(queue.status).toBe(200);
    expect(queue.body.total).toBe(0);
    expect(queue.body.items).toHaveLength(0);
  });
});
