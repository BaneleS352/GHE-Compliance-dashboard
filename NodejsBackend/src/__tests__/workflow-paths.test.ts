import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildApp, getTeamToken, getApproverToken, getHrToken, getCeoToken } from "./helpers";

const app = buildApp();

const DECLARATION_BASE = {
  employee: "Nomvula Team",
  employeeId: "user-team",
  teamMemberNumber: "TM-001",
  lineManager: "Sipho Approver",
  position: "Brand Manager",
  department: "Marketing",
  type: "Gift",
  submitted: "2026-07-05",
  approver: "Sipho Approver",
  status: "Draft",
  description: "Workflow path test",
  relationship: "Test",
  receivedGiven: "Received",
  from: "Supplier",
  contactPerson: "T",
  biddingProcess: "No",
  occasion: "Business Meeting",
  date: "2026-07-05",
  instances: "1",
  publicOfficial: "No",
};

function declBody(overrides: Record<string, unknown>) {
  return { ...DECLARATION_BASE, ...overrides };
}

describe("Workflow decision paths", () => {
  describe("Low-value (rule-1, LM only) — approval variants", () => {
    it("LM uses 'org' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathOrgLow", value: 100, priority: "Low" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      const inst1 = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getApproverToken()}`);
      expect(inst1.body.steps).toHaveLength(1);

      const res = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "org" });
      expect(res.status).toBe(200);
      expect(res.body.newStatus).toBe("Approved");
      expect(res.body.currentStep.decision).toBe("org");
      expect(res.body.currentStep.status).toBe("approved");
    });

    it("LM uses 'foundation' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathFndLow", value: 100, priority: "Low" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const res = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "foundation" });
      expect(res.status).toBe(200);
      expect(res.body.newStatus).toBe("Approved");
      expect(res.body.currentStep.decision).toBe("foundation");
    });
  });

  describe("Medium-value (rule-2, LM → HR) — mixed approval decisions", () => {
    it("LM uses 'org' → HR uses 'accept' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathOrgAccMed", value: 500, priority: "Medium" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "org" });
      expect(resLm.status).toBe(200);
      expect(resLm.body.newStatus).toBe("Pending");

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "accept" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Approved");
      expect(resHr.body.currentStep.decision).toBe("accept");
    });

    it("LM uses 'foundation' → HR uses 'escalate' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathFndEscMed", value: 500, priority: "Medium" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "foundation" });
      expect(resLm.status).toBe(200);

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "org" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.currentStep.decision).toBe("org");
    });
  });

  describe("Medium-value (rule-2, LM → HR) — terminal decisions at HR step", () => {
    it("LM accepts → HR declines → Declined", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathAccDecMed", value: 500, priority: "Medium" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });
      expect(resLm.status).toBe(200);
      expect(resLm.body.newStatus).toBe("Pending");

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "decline" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Declined");
      expect(resHr.body.currentStep.decision).toBe("decline");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].status).toBe("approved");
      expect(inst.body.steps[1].status).toBe("declined");
    });

    it("LM accepts → HR declines → Declined (duplicate)", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathAccRejMed", value: 500, priority: "Medium" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "decline" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Declined");
      expect(resHr.body.currentStep.decision).toBe("decline");
    });

    it("LM accepts → HR returns → Info Requested", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathAccRetMed", value: 500, priority: "Medium" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "return" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Info Requested");
      expect(resHr.body.currentStep.decision).toBe("return");
    });
  });

  describe("High-value (rule-3, LM → HR → CEO) — mixed approval decisions", () => {
    it("LM 'org' → HR 'foundation' → CEO 'accept' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathOrgFndAcc", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const inst1 = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst1.body.steps).toHaveLength(3);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "org" });
      expect(resLm.status).toBe(200);
      expect(resLm.body.newStatus).toBe("Pending");

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "foundation" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Pending");

      const resCeo = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getCeoToken()}`)
        .send({ declarationId: id, decision: "accept" });
      expect(resCeo.status).toBe(200);
      expect(resCeo.body.newStatus).toBe("Approved");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].decision).toBe("org");
      expect(inst.body.steps[0].status).toBe("approved");
      expect(inst.body.steps[1].decision).toBe("foundation");
      expect(inst.body.steps[1].status).toBe("approved");
      expect(inst.body.steps[2].decision).toBe("accept");
      expect(inst.body.steps[2].status).toBe("approved");
    });

    it("LM 'accept' → HR 'org' → CEO 'foundation' → fully approved", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathAccEscFnd", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "org" });

      const resCeo = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getCeoToken()}`)
        .send({ declarationId: id, decision: "foundation" });
      expect(resCeo.status).toBe(200);
      expect(resCeo.body.newStatus).toBe("Approved");
      expect(resCeo.body.currentStep.decision).toBe("foundation");
    });
  });

  describe("High-value (rule-3, LM → HR → CEO) — terminal decisions at different levels", () => {
    it("LM accepts → HR accepts → CEO declines → Declined", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "Path3DecCEO", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "accept" });

      const resCeo = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getCeoToken()}`)
        .send({ declarationId: id, decision: "decline" });
      expect(resCeo.status).toBe(200);
      expect(resCeo.body.newStatus).toBe("Declined");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].status).toBe("approved");
      expect(inst.body.steps[1].status).toBe("approved");
      expect(inst.body.steps[2].status).toBe("declined");
    });

    it("LM accepts → HR declines → Declined (terminal at HR)", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathRejHR", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "decline" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Declined");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].status).toBe("approved");
      expect(inst.body.steps[1].status).toBe("declined");
      expect(inst.body.steps[2].status).toBe("pending");
    });

    it("LM accepts → HR returns → Info Requested (terminal at HR)", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathRetHR", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "accept" });

      const resHr = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getHrToken()}`)
        .send({ declarationId: id, decision: "return" });
      expect(resHr.status).toBe(200);
      expect(resHr.body.newStatus).toBe("Info Requested");
    });

    it("LM returns → Info Requested (terminal at LM)", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathRetLM", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "return" });
      expect(resLm.status).toBe(200);
      expect(resLm.body.newStatus).toBe("Info Requested");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].status).toBe("returned");
      expect(inst.body.steps[1].status).toBe("pending");
      expect(inst.body.steps[2].status).toBe("pending");
    });

    it("LM declines → Declined (terminal at LM)", async () => {
      const create = await request(app)
        .post("/api/declarations")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .send(declBody({ counterparty: "PathDecLM", value: 3000, priority: "High" }));
      const id = create.body.id;

      await request(app)
        .patch(`/api/declarations/${id}/submit`)
        .set("Authorization", `Bearer ${getTeamToken()}`);

      const resLm = await request(app)
        .post("/api/workflows/approve")
        .set("Authorization", `Bearer ${getApproverToken()}`)
        .send({ declarationId: id, decision: "decline" });
      expect(resLm.status).toBe(200);
      expect(resLm.body.newStatus).toBe("Declined");

      const inst = await request(app)
        .get(`/api/workflows/instances/${id}`)
        .set("Authorization", `Bearer ${getTeamToken()}`);
      expect(inst.body.steps[0].status).toBe("declined");
    });
  });
});
