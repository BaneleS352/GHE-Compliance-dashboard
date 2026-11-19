export type DeclarationPriority = "Low" | "Medium" | "High";

/**
 * Derive the stored priority label from the configured thresholds. Workflow
 * routing is handled separately by determineRuleId and uses only the high
 * threshold.
 */
export function declarationPriorityForValue(
  value: number,
  highValueThreshold: number,
  mediumValueThreshold: number,
): DeclarationPriority {
  if (value >= highValueThreshold) return "High";
  if (value >= mediumValueThreshold) return "Medium";
  return "Low";
}
