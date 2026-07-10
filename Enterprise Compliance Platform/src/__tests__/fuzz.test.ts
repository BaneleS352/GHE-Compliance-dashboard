import { describe, it, expect, beforeEach } from "vitest";
import {
  addDeclaration, updateDeclaration, deleteUser, getDeclarations, getUsers,
  setWorkflowForDeclaration, getPendingWorkflowStepsForUser, canUserApprove,
  determineWorkflowSteps, invalidateCache, getConfig,
} from "../data/db";
import { authenticate } from "../app/auth/authService";
import { Declaration, StatusType, WorkflowInstance } from "../types/declaration";

/* Deterministic PRNG so failures are reproducible */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BAD_VALUES = [
  -5, NaN, Infinity, -Infinity, 1e308, 0, -0, 123.456,
  "abc", "", " ", "1e999", null as never, undefined as never,
  { x: 1 } as never, [] as never, true as never, "   -10  ", "R 500",
];

const BAD_STRINGS = [
  "", " ", "x".repeat(5), "y".repeat(250), "z".repeat(10001),
  "🚀".repeat(500), "\n\r\t", "<script>", null as never, undefined as never,
  123 as never, {} as never, [] as never,
];

const BAD_STATUSES = [
  "Bogus", "approved", "APPROVED", "Declined ", "PendingX", "", " ",
  null as never, undefined as never, 123 as never, "InfoRequested",
];

function makeBaseDecl(id: string): Declaration {
  return {
    id, employee: "Fuzz Tester", employeeId: "user-1", teamMemberNumber: "HB-00001",
    lineManager: "Sipho Nkosi", position: "Tester", department: "IT", company: "HB",
    team: "Test", type: "Gift", Counterparty: "Fuzz Co", value: 100, submitted: "2025-01-01",
    approver: "Lindiwe Zulu", status: "Pending", priority: "Low", description: "fuzz",
    relationship: "x", receivedGiven: "Received", from: "Supplier", contactPerson: "x",
    biddingProcess: "No", occasion: "Other", date: "2025-01-01", instances: "1", publicOfficial: "No",
  };
}

describe("Fuzz — db functions must never crash (only throw Error)", () => {
  beforeEach(() => invalidateCache());

  it("fuzz addDeclaration with fully random fields", () => {
    const rand = mulberry32(1);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    for (let i = 0; i < 400; i++) {
      const decl = makeBaseDecl(`FUZZ-${i}-${Math.floor(rand() * 1e6)}`);
      (decl as Record<string, unknown>).value = pick(BAD_VALUES);
      (decl as Record<string, unknown>).employee = pick(BAD_STRINGS);
      (decl as Record<string, unknown>).type = pick(BAD_STRINGS);
      (decl as Record<string, unknown>).Counterparty = pick(BAD_STRINGS);
      (decl as Record<string, unknown>).id = pick([`FUZZ-${i}`, "", " ", null as never, undefined as never, 123 as never]);
      (decl as Record<string, unknown>).description = pick([...BAD_STRINGS, "x".repeat(99999)]);

      try {
        addDeclaration(decl);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message.length).toBeGreaterThan(0);
      }
    }
  });

  it("fuzz updateDeclaration with random partial updates", () => {
    const rand = mulberry32(2);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const base = makeBaseDecl("FUZZ-UPDATE");
    addDeclaration(base);

    for (let i = 0; i < 400; i++) {
      const updates: Record<string, unknown> = {};
      const keys = ["value", "status", "employee", "Counterparty", "description", "priority", "type", "approver"];
      for (const k of keys) if (rand() < 0.5) updates[k] = pick([...BAD_VALUES, ...BAD_STRINGS, ...BAD_STATUSES] as unknown[]);
      try {
        updateDeclaration("FUZZ-UPDATE", updates as Partial<Declaration>);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz deleteUser with random ids", () => {
    const rand = mulberry32(3);
    const ids = getUsers().map((u) => u.id).concat(["", "nope", null as never, undefined as never, 123 as never, "user-1"]);
    for (let i = 0; i < 200; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      try {
        deleteUser(id as string);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz workflow helpers with random ids", () => {
    const rand = mulberry32(4);
    const ids = ["", "nope", null as never, undefined as never, 123 as never, "user-3", "user-99"];
    for (let i = 0; i < 200; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      expect(() => getPendingWorkflowStepsForUser(id as string)).not.toThrow();
      expect(() => canUserApprove({} as WorkflowInstance, id as string, "hr")).not.toThrow();
    }
  });

  it("fuzz determineWorkflowSteps with random values", () => {
    const rand = mulberry32(5);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    for (let i = 0; i < 300; i++) {
      const value = pick([...BAD_VALUES, rand() * 100000, -rand() * 1000] as unknown[]);
      const decl = makeBaseDecl("X");
      (decl as Record<string, unknown>).value = value;
      expect(() => determineWorkflowSteps(decl)).not.toThrow();
      const result = determineWorkflowSteps(decl);
      expect(["rule-1", "rule-2", "rule-3"]).toContain(result);
    }
  });

  it("fuzz authenticate with random credentials", () => {
    const rand = mulberry32(6);
    const chars = "abcdefghijklmnopqrstuvwxyz@.1234567890 AÖÑ".split("");
    const rstr = () => Array.from({ length: 1 + Math.floor(rand() * 30) }, () => chars[Math.floor(rand() * chars.length)]).join("");
    for (let i = 0; i < 300; i++) {
      const email = rand() < 0.3 ? null : (rand() < 0.5 ? undefined : rstr());
      const pw = rand() < 0.3 ? null : (rand() < 0.5 ? undefined : rstr());
      let res: unknown = "unset";
      expect(() => { res = authenticate(email as string, pw as string); }).not.toThrow();
      expect(res === null || typeof res === "object").toBe(true);
    }
  });
});

describe("Negative assertions — validation must reject clearly invalid data", () => {
  beforeEach(() => invalidateCache());

  it("rejects negative / NaN / non-numeric values", () => {
    for (const v of [-1, -100, NaN, Infinity, -Infinity, "abc", null, undefined, {}]) {
      const d = makeBaseDecl(`NEG-${Math.random()}`);
      (d as Record<string, unknown>).value = v as never;
      expect(() => addDeclaration(d)).toThrow();
    }
  });

  it("rejects missing required fields", () => {
    const d = makeBaseDecl("MISSING");
    delete (d as Record<string, unknown>).employee;
    delete (d as Record<string, unknown>).type;
    delete (d as Record<string, unknown>).Counterparty;
    expect(() => addDeclaration(d)).toThrow();
  });

  it("rejects invalid status on update", () => {
    addDeclaration(makeBaseDecl("STAT-1"));
    for (const s of BAD_STATUSES) {
      if (s === undefined) continue;
      expect(() => updateDeclaration("STAT-1", { status: s as StatusType })).toThrow();
    }
  });

  it("rejects updates to non-existent declaration", () => {
    expect(() => updateDeclaration("DOES-NOT-EXIST", { status: "Pending" })).toThrow();
  });

  it("rejects duplicate declaration id", () => {
    addDeclaration(makeBaseDecl("DUP-1"));
    expect(() => addDeclaration(makeBaseDecl("DUP-1"))).toThrow();
  });

  it("rejects description over 10000 chars", () => {
    const d = makeBaseDecl("LONG-1");
    d.description = "x".repeat(10001);
    expect(() => addDeclaration(d)).toThrow();
  });

  it("rejects deleting the last admin", () => {
    const admin = getUsers().find((u) => u.role === "admin");
    expect(() => deleteUser(admin!.id)).toThrow();
  });

  it("authenticate rejects wrong/empty passwords", async () => {
    expect(await authenticate("admin@hb.co.za", "")).toBeNull();
    expect(await authenticate("admin@hb.co.za", "wrong")).toBeNull();
    expect(await authenticate("", "password")).toBeNull();
  });

  it("determineWorkflowSteps respects thresholds", () => {
    expect(determineWorkflowSteps({ value: 0 } as Declaration)).toBe("rule-1");
    expect(determineWorkflowSteps({ value: 250 } as Declaration)).toBe("rule-1");
    expect(determineWorkflowSteps({ value: 251 } as Declaration)).toBe("rule-2");
    expect(determineWorkflowSteps({ value: getConfig().highValueThreshold } as Declaration)).toBe("rule-2");
    expect(determineWorkflowSteps({ value: getConfig().highValueThreshold + 1 } as Declaration)).toBe("rule-3");
  });
});

describe("Sanity — valid data still works", () => {
  beforeEach(() => invalidateCache());

  it("minimal valid declaration is accepted", () => {
    const before = getDeclarations().length;
    expect(() => addDeclaration(makeBaseDecl("OK-1"))).not.toThrow();
    expect(getDeclarations().length).toBe(before + 1);
  });

  it("can create and approve a workflow", () => {
    addDeclaration(makeBaseDecl("WF-1"));
    expect(() => setWorkflowForDeclaration({
      declarationId: "WF-1",
      steps: [{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho", label: "LM", status: "pending", decision: null, notes: "", decidedAt: null }],
    })).not.toThrow();
    expect(getPendingWorkflowStepsForUser("user-3").length).toBeGreaterThan(0);
  });
});
