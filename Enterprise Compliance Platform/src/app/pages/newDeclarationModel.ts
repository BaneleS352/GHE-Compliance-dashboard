export const OCCASION_OPTIONS = [
  "Business Meeting", "Festive Season", "Milestone", "Other", "Relationship Maintenance", "Year End",
];

export type DeclarationPriority = "High" | "Medium" | "Low";

export interface DeclarationFormState {
  employeeName: string; employeeCode: string; lineManager: string; company: string;
  organizationId: number | ""; department: string; team: string; position: string;
  partyType: string; Counterparty: string; contactPerson: string; existingRelationship: string;
  contractNegotiation: string; biddingProcess: string; occasion: string; occasionOther: string;
  date: string; value: string; currency: string; substantiation: string; instances: string;
  description: string;
}

export interface DeclarationValidationConfig { highValueThreshold: number; maximumValue?: number; }

export function validateDeclarationForm(form: DeclarationFormState, category: string, config: DeclarationValidationConfig, profileIdentityLocked: boolean): Record<string, string> {
  const value = Number(form.value || 0);
  const requiresSubstantiation = Number.isFinite(value) && value >= config.highValueThreshold;
  const errors: Record<string, string> = {};
  if (!form.employeeName.trim()) errors.employeeName = "Required";
  if (!form.employeeCode.trim()) errors.employeeCode = "Required";
  if (!profileIdentityLocked) {
    if (!form.lineManager.trim()) errors.lineManager = "Required";
    if (!form.company.trim()) errors.company = "Required";
    if (!form.department.trim()) errors.department = "Required";
  }
  if (!form.position.trim()) errors.position = "Required";
  if (!form.partyType) errors.partyType = "Required";
  if (!form.Counterparty.trim()) errors.Counterparty = "Required";
  if (!form.contactPerson.trim()) errors.contactPerson = "Required";
  if (!form.existingRelationship) errors.existingRelationship = "Required";
  if (!form.contractNegotiation) errors.contractNegotiation = "Required";
  if (!form.biddingProcess) errors.biddingProcess = "Required";
  if (!category) errors.category = "Required";
  if (!form.description.trim()) errors.description = "Required";
  if (!form.date) errors.date = "Required";
  if (form.value && value > (config.maximumValue ?? 1000000)) errors.value = `Maximum value exceeded. Please enter an amount of R${(config.maximumValue ?? 1000000).toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.`;
  if (form.occasion === "Other" && !form.occasionOther.trim()) errors.occasionOther = "Required";
  if (requiresSubstantiation && !form.substantiation.trim()) errors.substantiation = "Required";
  return errors;
}

export function getPriority(value: number, highThreshold: number, mediumThreshold: number): DeclarationPriority {
  if (value >= highThreshold) return "High";
  if (value >= mediumThreshold) return "Medium";
  return "Low";
}

export function formatRandValue(value: string, fixedDecimals = false): string {
  if (!value) return "";
  const hasTrailingDot = value.endsWith(".");
  const [integerPartRaw, decimalPartRaw = ""] = value.split(".");
  const integerPart = (integerPartRaw || "0").replace(/^0+(?=\d)/, "") || "0";
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (fixedDecimals) return `${groupedInteger}.${(decimalPartRaw + "00").slice(0, 2)}`;
  return `${groupedInteger}${hasTrailingDot ? "." : decimalPartRaw ? `.${decimalPartRaw.slice(0, 2)}` : ""}`;
}

export function parseRandInput(raw: string): string {
  const cleaned = raw.replace(/[Rr\s]/g, "").replace(/[^\d.,]/g, "");
  if (!cleaned) return "";
  const separatorIndex = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
  if (separatorIndex === -1) {
    const integerOnly = cleaned.replace(/[^\d]/g, "");
    return integerOnly.replace(/^0+(?=\d)/, "") || "0";
  }
  const integerPart = cleaned.slice(0, separatorIndex).replace(/[^\d]/g, "");
  const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, "").slice(0, 2);
  return `${integerPart.replace(/^0+(?=\d)/, "") || "0"}.${decimalPart}`;
}
