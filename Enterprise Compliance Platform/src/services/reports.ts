import { api } from "./httpClient";

export interface ReportsData {
  statusBreakdown: Record<string, number>;
  slaData: Array<{ role: string; avg: number; min: number; max: number; count: number }>;
  counterpartyData: Array<{ counterparty: string; count: number; totalValue: number; avgValue: number }>;
  highValueData: Array<{ employee: string; lineManager: string; declarationCount: number; totalValue: number; averageValue: number; totalGift: number; totalHospitality: number; totalEntertainment: number; mostFrequentSupplier: string }>;
  declarations: any[];
  departments: string[];
}

function buildParams(params?: Record<string, string>): string {
  if (!params) return "";
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v && v !== "All Departments" && v !== "All Statuses") cleaned[k] = v;
  return Object.keys(cleaned).length ? `?${new URLSearchParams(cleaned)}` : "";
}

function normalizeHighValueRows(rows: any[]): ReportsData["highValueData"] {
  if (rows.every((row) => row && typeof row.totalValue === "number")) return rows;
  const groups = new Map<string, any>();
  for (const row of rows) {
    const value = Number(row.value) || 0;
    const current = groups.get(row.employee) || { employee: row.employee, lineManager: row.lineManager || "", declarationCount: 0, totalValue: 0, totalGift: 0, totalHospitality: 0, totalEntertainment: 0, suppliers: new Map<string, number>() };
    current.declarationCount++;
    current.totalValue += value;
    if (row.type === "Gift") current.totalGift += value;
    if (row.type === "Hospitality") current.totalHospitality += value;
    if (row.type === "Entertainment") current.totalEntertainment += value;
    current.suppliers.set(row.counterparty || "Unknown", (current.suppliers.get(row.counterparty || "Unknown") || 0) + 1);
    groups.set(row.employee, current);
  }
  return [...groups.values()].map((row) => ({ ...row, averageValue: row.totalValue / row.declarationCount, mostFrequentSupplier: [...row.suppliers.entries()].sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || "Unknown" })).sort((a, b) => b.totalValue - a.totalValue);
}

export async function fetchReports(params?: Record<string, string>): Promise<ReportsData> {
  const qs = buildParams(params);
  const [statusBreakdown, slaData, counterpartyData, highValueData, declarations] = await Promise.all([
    api.get<Record<string, number>>(`/api/reports/status-breakdown${qs}`),
    api.get<any[]>(`/api/reports/sla${qs}`),
    api.get<any[]>(`/api/reports/counterparty-concentration${qs}`),
    api.get<any[]>(`/api/reports/high-value${qs}`),
    api.get<any[]>(`/api/reports/list${qs}`),
  ]);
  const departments = [...new Set(declarations.map((d: any) => d.department).filter(Boolean))].sort();
  return { statusBreakdown, slaData, counterpartyData, highValueData: normalizeHighValueRows(highValueData), declarations, departments };
}
