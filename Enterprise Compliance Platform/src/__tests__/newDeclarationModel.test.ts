import { describe, expect, it } from "vitest";
import { buildDeclarationPayload, formatRandValue, getPriority, parseRandInput, validateDeclarationForm } from "../app/pages/newDeclarationModel";

describe("new declaration model helpers", () => {
  it("classifies configured value priorities", () => {
    expect(getPriority(1000, 5000, 1000)).toBe("Medium");
    expect(getPriority(5000, 5000, 1000)).toBe("High");
    expect(getPriority(999, 5000, 1000)).toBe("Low");
  });

  it("normalizes Rand input and formats it for display", () => {
    expect(parseRandInput("R 001 234,567")).toBe("1234.56");
    expect(formatRandValue("1234.5", true)).toBe("1 234.50");
    expect(formatRandValue("12.")).toBe("12.");
  });

  it("validates required fields and conditional business rules", () => {
    const errors = validateDeclarationForm({
      employeeName: "", employeeCode: "", lineManager: "", company: "", organizationId: "", department: "", team: "", position: "",
      partyType: "", Counterparty: "", contactPerson: "", existingRelationship: "", contractNegotiation: "", biddingProcess: "",
      occasion: "Other", occasionOther: "", date: "", value: "5000", currency: "ZAR", substantiation: "", instances: "1", description: "",
    }, "", { highValueThreshold: 1000, maximumValue: 10000 }, false);
    expect(errors.employeeName).toBe("Required");
    expect(errors.occasionOther).toBe("Required");
    expect(errors.substantiation).toBe("Required");
  });

  it("builds a domain declaration with normalized conditional fields", () => {
    const declaration = buildDeclarationPayload({
      user: { id: 7, name: "A User", email: "a@example.com", role: "teamMember", teamMemberNumber: "TM-7", department: "IT", position: "Engineer", lineManager: "Manager" },
      form: {
        employeeName: "A User", employeeCode: "TM-7", lineManager: "Manager", company: "HB", organizationId: 1, department: "IT", team: "", position: "Engineer",
        partyType: "Supplier", Counterparty: "Supplier Co", contactPerson: "Contact", existingRelationship: "Yes", contractNegotiation: "No", biddingProcess: "No",
        occasion: "Other", occasionOther: "Business event", date: "2026-01-01", value: "5000", currency: "ZAR", substantiation: "Approved exception", instances: "1", description: "Dinner",
      },
      category: "Gift", receivedGiven: "Received", files: [], highValueThreshold: 1000, mediumValueThreshold: 500, draftId: "GHE-DRAFT", draftStatus: "Draft",
    });
    expect(declaration).toMatchObject({ id: "GHE-DRAFT", employeeId: 7, occasion: "Business event", priority: "High", substantiation: "Approved exception" });
  });
});
