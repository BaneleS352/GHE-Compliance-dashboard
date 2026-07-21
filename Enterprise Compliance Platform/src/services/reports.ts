import { api } from "./httpClient";

export interface ReportsData {
  statusBreakdown: Record<string, number>;
  slaData: Array<{ role: string; avg: number; min: number; max: number; count: number }>;
  counterpartyData: Array<{ counterparty: string; count: number; totalValue: number; avgValue: number }>;
  highValueData: any[];
  declarations: any[];
  departments: string[];
}

function buildParams(params?: Record<string, string>): string {
  if (!params) return "";
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v && v !== "All Departments" && v !== "All Statuses") cleaned[k] = v;
  }
  return Object.keys(cleaned).length > 0 ? `?${new URLSearchParams(cleaned)}` : "";
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

  const departments = [...new Set(
    (declarations as any[]).map((d: any) => d.department).filter(Boolean)
  )].sort();

  return { statusBreakdown, slaData, counterpartyData, highValueData, declarations, departments };
}
