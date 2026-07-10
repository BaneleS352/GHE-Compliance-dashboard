import { SystemConfig, Dropdowns, ComplianceTrendPoint, TypeBreakdownItem, Declaration } from "../../types/declaration";
import { get, persist } from "../db";

export function getConfig(): SystemConfig {
  return get().config;
}

export function saveConfig(config: SystemConfig) {
  const db = get();
  db.config = config;
  persist();
}

export function getDropdowns(): Dropdowns {
  return get().dropdowns;
}

export function updateDropdowns(dropdowns: Dropdowns) {
  for (const [key, arr] of Object.entries(dropdowns)) {
    if (!arr || arr.length === 0) {
      throw new Error(`Dropdown "${key}" cannot be empty.`);
    }
  }
  get().dropdowns = dropdowns;
  persist();
}

export function getComplianceTrend(): ComplianceTrendPoint[] {
  return get().complianceTrend;
}

export function getTypeBreakdown(): TypeBreakdownItem[] {
  return get().typeBreakdown;
}

export function getApprovalOptions(): { value: string; label: string }[] {
  return get().approvalOptions;
}

export function determineWorkflowSteps(declaration: Declaration) {
  const config = getConfig();
  const value = Number(declaration.value);
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "rule-1";
  if (value > config.highValueThreshold) return "rule-3";
  if (value > config.mediumValueThreshold) return "rule-2";
  return "rule-1";
}