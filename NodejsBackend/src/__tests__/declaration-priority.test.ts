import { describe, expect, it } from "vitest";
import { declarationPriorityForValue } from "../services/declarationPriority";

describe("declaration priority policy", () => {
  const high = 1000;
  const medium = 500;

  it("uses the medium threshold for medium labels", () => {
    expect(declarationPriorityForValue(499.99, high, medium)).toBe("Low");
    expect(declarationPriorityForValue(500, high, medium)).toBe("Medium");
    expect(declarationPriorityForValue(999.99, high, medium)).toBe("Medium");
  });

  it("uses the high threshold for high labels", () => {
    expect(declarationPriorityForValue(1000, high, medium)).toBe("High");
    expect(declarationPriorityForValue(1500, high, medium)).toBe("High");
  });

  it("gives the high threshold precedence when thresholds overlap", () => {
    expect(declarationPriorityForValue(1000, 1000, 1000)).toBe("High");
  });
});
