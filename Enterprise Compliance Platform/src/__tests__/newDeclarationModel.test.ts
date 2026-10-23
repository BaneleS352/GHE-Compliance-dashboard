import { describe, expect, it } from "vitest";
import { formatRandValue, getPriority, parseRandInput, validateDeclarationForm } from "../app/pages/newDeclarationModel";

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
});
