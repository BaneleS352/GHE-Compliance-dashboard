import { describe, it, expect, beforeEach } from "vitest";
import {
  addUser, updateUser, deleteUser, getUsers, addDeclaration,
  setWorkflowForDeclaration, updateWorkflowRule, deleteWorkflowRule,
  getWorkflowRules, saveConfig, getConfig,
  invalidateCache,
} from "../data/db";
import { authenticate } from "../app/auth/authService";
import { User, Declaration, WorkflowRule } from "../types/declaration";

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
  { x: 1 } as never, [] as never, true as never, "   -10  ",
];

const BAD_STRINGS = [
  "", " ", "x".repeat(5), "y".repeat(250), "z".repeat(10001),
  "\n\r\t", "<script>", null as never, undefined as never,
  123 as never, {} as never, [] as never,
];

const BAD_EMAILS = [
  "", " ", "not-an-email", "@nodomain", "spaces in@email.com",
  null as never, undefined as never, 123 as never, {} as never,
  "a@b.c", "x".repeat(300) + "@test.com",
];

const BAD_ROLES = [
  "", " ", "superadmin", "user", "APPROVER", null as never,
  undefined as never, 123 as never, {} as never, [] as never,
];

describe("Extended Fuzz — addUser / updateUser must never crash", () => {
  beforeEach(() => invalidateCache());

  it("fuzz addUser with random field values", () => {
    const rand = mulberry32(10);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    for (let i = 0; i < 300; i++) {
      const user: User = {
        id: `FUZZ-USER-${i}-${Math.floor(rand() * 1e6)}`,
        name: pick(BAD_STRINGS) || "Fuzz User",
        email: pick(BAD_EMAILS) || `fuzz${i}@test.com`,
        passwordHash: pick(BAD_STRINGS) || "",
        role: pick(BAD_ROLES) as User["role"] || "teamMember",
        teamMemberNumber: pick(BAD_STRINGS) || "TM-FUZZ",
        department: pick(BAD_STRINGS) || "IT",
        position: pick(BAD_STRINGS) || "Dev",
        lineManager: pick([...BAD_STRINGS, null as never] as never[]),
      };
      try {
        addUser(user);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect((e as Error).message.length).toBeGreaterThan(0);
      }
    }
  });

  it("fuzz updateUser with random partial updates", () => {
    const rand = mulberry32(11);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const user: User = {
      id: "FUZZ-UPDATE-TARGET",
      name: "Fuzz Target",
      email: "fuzz-target@test.com",
      passwordHash: "",
      role: "teamMember",
      teamMemberNumber: "TM-FT",
      department: "Finance",
      position: "Analyst",
      lineManager: "user-3",
    };
    addUser(user);

    const keys: (keyof User)[] = ["name", "email", "role", "department", "position", "teamMemberNumber", "lineManager"];
    for (let i = 0; i < 300; i++) {
      const updates: Record<string, unknown> = {};
      for (const k of keys) {
        if (rand() < 0.4) {
          updates[k] = pick([...BAD_STRINGS, ...BAD_ROLES, ...BAD_EMAILS] as unknown[]);
        }
      }
      try {
        updateUser("FUZZ-UPDATE-TARGET", updates as Partial<User>);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz updateUser with non-existent ids", () => {
    const rand = mulberry32(12);
    const ids = ["", "nope", null as never, undefined as never, 123 as never, "user-99999"];
    for (let i = 0; i < 100; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      expect(() => updateUser(id as string, { name: "whatever" })).not.toThrow();
    }
  });

  it("fuzz deleteUser with random ids", () => {
    const rand = mulberry32(13);
    const ids = getUsers().map((u) => u.id).concat(
      ["", "nope", null as never, undefined as never, 123 as never, "user-1", "user-6"]
    );
    for (let i = 0; i < 200; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      try {
        deleteUser(id as string);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe("Extended Fuzz — workflow functions must never crash", () => {
  beforeEach(() => invalidateCache());

  it("fuzz setWorkflowForDeclaration with random data", { timeout: 10000 }, () => {
    const rand = mulberry32(20);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const badDeclIds = ["", "nope", null as never, undefined as never, 123 as never, "x".repeat(1000)];
    const badStepStatuses = ["", " ", "APPROVED", "PendingX", null as never, undefined as never, 123 as never, "maybe"];
    const badRoles = ["", " ", "lineManager ", "LineManager", "manager", "ceo ", null as never, undefined as never];

    for (let i = 0; i < 150; i++) {
      const instance = {
        declarationId: pick(badDeclIds) as string || `FUZZ-WF-${i}`,
        steps: Array.from({ length: 1 + Math.floor(rand() * 5) }, (_, si) => ({
          order: pick([-1, 0, 1, 2, NaN, null as never, undefined as never] as never[]),
          role: pick(badRoles) as any || "lineManager",
          assignee: pick(badDeclIds) as string || "user-3",
          assigneeName: pick(BAD_STRINGS) as string || "Name",
          label: pick(BAD_STRINGS) as string || "Review",
          status: pick(badStepStatuses) as any || "pending",
          decision: pick([null, "accept", "org", "decline", 123, {}, []] as never[]),
          notes: pick(BAD_STRINGS) as string || "",
          decidedAt: pick([null, "", "not-a-date", 123, {}] as never[]),
        })),
      };
      try {
        setWorkflowForDeclaration(instance as any);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz updateWorkflowRule with random updates", () => {
    const rand = mulberry32(21);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const badStepRole = ["", " ", "ceo ", "LineManager", null as never, undefined as never, 123 as never];

    for (let i = 0; i < 100; i++) {
      const updates: Record<string, unknown> = {};
      if (rand() < 0.5) updates.name = pick(BAD_STRINGS);
      if (rand() < 0.4) {
        updates.steps = [
          { order: 1, role: pick(badStepRole), label: pick(BAD_STRINGS) as string || "Step" },
        ];
      }
      try {
        updateWorkflowRule("rule-1", updates as any);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz updateWorkflowRule with non-existent rule id", { timeout: 10000 }, () => {
    const rand = mulberry32(22);
    const ids = ["", "nope", null as never, undefined as never, 123 as never, "rule-99"];
    for (let i = 0; i < 100; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      try {
        updateWorkflowRule(id as string, { name: "test" });
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });

  it("fuzz deleteWorkflowRule with random ids", () => {
    const rand = mulberry32(23);
    const rules = getWorkflowRules();
    const ids = rules.map((r) => r.id).concat(
      ["", "nope", null as never, undefined as never, 123 as never]
    );
    for (let i = 0; i < 100; i++) {
      const id = ids[Math.floor(rand() * ids.length)];
      expect(() => deleteWorkflowRule(id as string)).not.toThrow();
    }
  });
});

describe("Extended Fuzz — saveConfig must never crash", () => {
  beforeEach(() => invalidateCache());

  it("fuzz saveConfig with random values", () => {
    const rand = mulberry32(30);
    const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
    const keys = ["highValueThreshold", "mediumValueThreshold", "slaEscalationDays", "maxDeclarationsPerCounterparty", "emailTemplate"];

    for (let i = 0; i < 200; i++) {
      const cfg = getConfig();
      const updates: Record<string, unknown> = {};
      for (const k of keys) {
        if (rand() < 0.4) {
          updates[k] = pick([...BAD_VALUES, rand() * 1e6, -rand() * 1000, "abc", { x: 1 }, []] as unknown[]);
        }
      }
      try {
        saveConfig({ ...cfg, ...updates } as any);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
      }
    }
  });
});

describe("Extended Fuzz — authenticate with worst-case inputs", () => {
  beforeEach(() => invalidateCache());

  it("fuzz authenticate with pathological strings", async () => {
    const rand = mulberry32(40);
    const pathological = [
      "", " ", "\0", "\n", "\r\n", "\t", "a".repeat(10000),
      "<script>alert('xss')</script>", "admin'--", "admin@hb.co.za\n",
      String.fromCharCode(0), String.fromCharCode(65533),
      null as never, undefined as never,
    ];

    for (let i = 0; i < 200; i++) {
      const email = pathological[Math.floor(rand() * pathological.length)];
      const pw = pathological[Math.floor(rand() * pathological.length)];
      let caught = false;
      try {
        const res = await authenticate(email as string, pw as string);
        expect(res === null || typeof res === "object").toBe(true);
      } catch {
        caught = true;
      }
      expect(caught).toBe(false);
    }
  });
});

describe("Extended negative assertions", () => {
  beforeEach(() => invalidateCache());

  it("addUser rejects empty required fields", () => {
    const base: User = {
      id: "neg-user-1", name: "", email: "", passwordHash: "", role: "teamMember",
      teamMemberNumber: "TM-NEG", department: "IT", position: "Dev", lineManager: "user-3",
    };
    expect(() => addUser({ ...base, name: "" })).toThrow();
    expect(() => addUser({ ...base, name: "Name", email: "" })).toThrow();
    expect(() => addUser({ ...base, name: "Name", email: "e@t.com", role: "" as any })).toThrow();
  });

  it("setWorkflowForDeclaration with empty declarationId is rejected", () => {
    expect(() => setWorkflowForDeclaration({
      declarationId: "",
      steps: [],
    } as any)).toThrow();
  });

  it("updateWorkflowRule with invalid step role throws", () => {
    expect(() => updateWorkflowRule("rule-2", {
      steps: [{ order: 1, role: "INVALID" as any, label: "Bad" }],
    })).toThrow();
  });

  it("authenticate with non-existent email returns null", async () => {
    expect(await authenticate("does.not.exist@nowhere.com", "password")).toBeNull();
  });

  it("authenticate with wrong password for stored hash returns null", async () => {
    expect(await authenticate("admin@hb.co.za", "definitely-wrong")).toBeNull();
  });
});
