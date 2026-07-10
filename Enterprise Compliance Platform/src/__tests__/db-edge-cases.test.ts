import { describe, it, expect, beforeEach } from "vitest";
import seed from "../data/database.json";
import {
  getConfig, saveConfig, getUsers, getUserById, getUserByEmail,
  addUser, updateUser, deleteUser,
  getDeclarations, getDeclarationsByEmployee, getDeclarationById,
  addDeclaration, updateDeclaration,
  getWorkflowRules, addWorkflowRule, updateWorkflowRule, deleteWorkflowRule,
  getWorkflowForDeclaration, setWorkflowForDeclaration,
  getPendingWorkflowStepsForUser,
  getDropdowns, updateDropdowns,
  determineWorkflowSteps,
} from "../data/db";
import type { Declaration, User, WorkflowInstance } from "../types/declaration";

function makeDecl(overrides: Partial<Declaration> = {}): Declaration {
  return {
    id: "TEST-0001",
    employee: "Test User",
    employeeId: "user-test",
    department: "IT",
    type: "Gift",
    Counterparty: "Test Corp",
    value: 500,
    submitted: "2025-01-01",
    approver: "user-3",
    status: "Pending",
    priority: "Low",
    description: "Test",
    relationship: "Supplier",
    teamMemberNumber: "TM-001",
    lineManager: "user-3",
    position: "Tester",
    receivedGiven: "Received",
    from: "Supplier",
    contactPerson: "Contact",
    biddingProcess: "No",
    occasion: "Test",
    date: "2025-01-01",
    instances: "1",
    publicOfficial: "No",
    ...overrides,
  };
}

describe("Data layer edge cases — designed to break", () => {

  /* ─── Empty / missing ID lookups ─── */
  describe("getUserById / getUserByEmail with edge inputs", () => {
    it("getUserById('') returns undefined (might crash callers)", () => {
      const r = getUserById("");
      expect(r).toBeUndefined();
    });
    it("getUserById('nonexistent') returns undefined", () => {
      expect(getUserById("does-not-exist")).toBeUndefined();
    });
    it("getUserByEmail('') returns undefined", () => {
      expect(getUserByEmail("")).toBeUndefined();
    });
  });

  /* ─── getDeclarationsByEmployee with empty string ─── */
  describe("getDeclarationsByEmployee empty edge", () => {
    it("filters by employeeId, but seed has declarations with employeeId ''", () => {
      expect(typeof getDeclarationsByEmployee("").length).toBe("number");
    });
  });

  /* ─── determineWorkflowStep boundaries ─── */
  describe("determineWorkflowStep boundaries", () => {
    it("value = 0 returns rule-1 (LM only)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: 0 }))).toBe("rule-1");
    });
    it("value = 250 returns rule-1 (boundary, should be LM only)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: 250 }))).toBe("rule-1");
    });
    it("value = 251 returns rule-2 (LM + HR)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: 251 }))).toBe("rule-2");
    });
    it("value = 2500 returns rule-2 (boundary, LM + HR)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: 2500 }))).toBe("rule-2");
    });
    it("value = 2501 returns rule-3 (LM + HR + CEO)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: 2501 }))).toBe("rule-3");
    });
    it("value = -1 returns rule-1 (negative value silently treated as low)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: -1 }))).toBe("rule-1");
    });
    it("value = NaN returns rule-1 (silent fallback, hides error)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: NaN }))).toBe("rule-1");
    });
    it("value = Infinity returns rule-1 (massive value silently treated as low!)", () => {
      expect(determineWorkflowSteps(makeDecl({ value: Infinity }))).toBe("rule-1");
    });
    it("value missing (undefined via spread) — value is undefined but TS allows since Declaration requires value", () => {
      const bad = makeDecl() as Record<string, unknown>;
      delete bad.value;
      const result = determineWorkflowSteps(bad as unknown as Declaration);
      expect(result).toBe("rule-1");
    });
  });

  /* ─── addDeclaration with extreme / invalid values ─── */
  describe("addDeclaration edge cases", () => {
    it("addDeclaration throws on negative value (no longer silently accepts)", () => {
      const d = makeDecl({ id: "NEG-0001", value: -5000 });
      expect(() => addDeclaration(d)).toThrow("Declaration value must be a non-negative number.");
    });

    it("addDeclaration throws on duplicate ID", () => {
      const d1 = makeDecl({ id: "DUP-0001", value: 100 });
      addDeclaration(d1);
      const d2 = makeDecl({ id: "DUP-0001", value: 99999 });
      expect(() => addDeclaration(d2)).toThrow("Declaration with ID \"DUP-0001\" already exists.");
      updateDeclaration("DUP-0001", { status: "Declined" });
    });

    it("addDeclaration throws on empty required fields", () => {
      const d = makeDecl({
        id: "EMPTY-01",
        employee: "",
        Counterparty: "",
        type: "",
        department: "",
        description: "",
      });
      expect(() => addDeclaration(d)).toThrow("Employee, type, and counterparty are required.");
    });

    it("addDeclaration throws on excessively long string fields", () => {
      const long = "A".repeat(10001);
      const d = makeDecl({ id: "LONG-01", description: long });
      expect(() => addDeclaration(d)).toThrow("Description too long (max 10000 characters).");
    });
  });

  /* ─── updateDeclaration edge cases ─── */
  describe("updateDeclaration edge cases", () => {
    it("updateDeclaration on non-existent ID throws error", () => {
      expect(() => updateDeclaration("DOES-NOT-EXIST-AT-ALL", { status: "Approved" }))
        .toThrow('Declaration with id "DOES-NOT-EXIST-AT-ALL" not found.');
    });

    it("updateDeclaration with invalid status type throws error", () => {
      const d = makeDecl({ id: "BADSTATUS-01" });
      addDeclaration(d);
      expect(() => updateDeclaration("BADSTATUS-01", { status: "InvalidStatus" as never }))
        .toThrow('Invalid status: "InvalidStatus". Must be one of: Draft, Pending, Approved, Declined, Escalated, Info Requested.');
    });
  });

  /* ─── deleteUser with orphaned data ─── */
  describe("deleteUser — orphaned data", () => {
    it("can delete a user who owns declarations with pending steps", () => {
      const u: User = {
        id: "user-orphan",
        name: "Orphan Test",
        email: "orphan@test.com",
        passwordHash: "",
        role: "teamMember",
        teamMemberNumber: "TM-ORPHAN",
        department: "IT",
        position: "Tester",
        lineManager: "user-3",
      };
      addUser(u);
      const d = makeDecl({ id: "ORPHAN-01", employeeId: "user-orphan" });
      addDeclaration(d);
      // Create workflow instance with pending step
      setWorkflowForDeclaration({
        declarationId: "ORPHAN-01",
        steps: [
          { order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null },
        ],
      });
      expect(() => deleteUser("user-orphan")).toThrow(
        'Cannot delete user "Orphan Test". Declaration "ORPHAN-01" has pending approval steps.'
      );
    });

    it("can delete the last admin user (leaves system without admin)", () => {
      expect(() => deleteUser("user-6")).toThrow("Cannot delete the last admin user.");
    });
  });

  /* ─── Configuration edge cases ─── */
  describe("Config edge cases", () => {
    it("can save config with empty email template", () => {
      const cfg = getConfig();
      const original = cfg.emailTemplate;
      saveConfig({ ...cfg, emailTemplate: "" });
      const updated = getConfig();
      expect(updated.emailTemplate).toBe("");
      saveConfig({ ...cfg, emailTemplate: original });
    });

    it("can set threshold to 0 (disables all HR/CEO review)", () => {
      const cfg = getConfig();
      const original = cfg.highValueThreshold;
      saveConfig({ ...cfg, highValueThreshold: 0 });
      const d = makeDecl({ value: 10 });
      expect(determineWorkflowSteps(d)).toBe("rule-3");
      saveConfig({ ...cfg, highValueThreshold: original });
    });
  });

  /* ─── Dropdowns / config integrity ─── */
  describe("Data integrity", () => {
    it("updateDropdowns with empty arrays clears dropdown options", () => {
      const orig = getDropdowns();
      expect(() => updateDropdowns({
        departments: [],
        categories: [],
        occasions: [],
        receivedGiven: [],
        biddingProcess: [],
        publicOfficial: [],
        relationships: [],
        partyTypes: [],
      })).toThrow();
      updateDropdowns(orig);
    });
  });
});