import { api } from "./httpClient";

export interface ReportDeclarationDto {
  department?: string | null;
}

export interface SlaReportRow {
  [key: string]: unknown;
  role: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export interface CounterpartyReportRow {
  [key: string]: unknown;
  counterparty: string;
  count: number;
  totalValue: number;
  avgValue: number;
}

export interface HighValueSourceRow {
  employee: string;
  lineManager?: string | null;
  value: number;
  type: "Gift" | "Hospitality" | "Entertainment" | string;
  counterparty?: string | null;
}

export interface HighValueSummaryRow {
  [key: string]: unknown;
  employee: string;
  lineManager: string;
  declarationCount: number;
  totalValue: number;
  averageValue: number;
  totalGift: number;
  totalHospitality: number;
  totalEntertainment: number;
  mostFrequentSupplier: string;
}

export interface ReportsData {
  statusBreakdown: Record<string, number>;
  slaData: SlaReportRow[];
  counterpartyData: CounterpartyReportRow[];
  highValueData: HighValueSummaryRow[];
  declarations: ReportDeclarationDto[];
  departments: string[];
}

function buildParams(params?: Record<string, string>): string {
  if (!params) return "";
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) if (v && v !== "All Departments" && v !== "All Statuses") cleaned[k] = v;
  return Object.keys(cleaned).length ? `?${new URLSearchParams(cleaned)}` : "";
}

function isHighValueSummary(row: HighValueSourceRow | HighValueSummaryRow): row is HighValueSummaryRow {
  return "declarationCount" in row && typeof row.totalValue === "number";
}

function normalizeHighValueRows(rows: Array<HighValueSourceRow | HighValueSummaryRow>): HighValueSummaryRow[] {
  if (rows.every(isHighValueSummary)) return rows;
  const groups = new Map<string, {
    employee: string;
    lineManager: string;
    declarationCount: number;
    totalValue: number;
    totalGift: number;
    totalHospitality: number;
    totalEntertainment: number;
    suppliers: Map<string, number>;
  }>();
  for (const row of rows.filter((candidate): candidate is HighValueSourceRow => !isHighValueSummary(candidate))) {
    const value = Number(row.value) || 0;
    const current = groups.get(row.employee) || {
      employee: row.employee,
      lineManager: row.lineManager || "",
      declarationCount: 0,
      totalValue: 0,
      totalGift: 0,
      totalHospitality: 0,
      totalEntertainment: 0,
      suppliers: new Map<string, number>(),
    };
    current.declarationCount++;
    current.totalValue += value;
    if (row.type === "Gift") current.totalGift += value;
    if (row.type === "Hospitality") current.totalHospitality += value;
    if (row.type === "Entertainment") current.totalEntertainment += value;
    current.suppliers.set(row.counterparty || "Unknown", (current.suppliers.get(row.counterparty || "Unknown") || 0) + 1);
    groups.set(row.employee, current);
  }
  return [...groups.values()].map(({ suppliers, ...row }) => ({
    ...row,
    averageValue: row.totalValue / row.declarationCount,
    mostFrequentSupplier: [...suppliers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Unknown",
  })).sort((a, b) => b.totalValue - a.totalValue);
}

export async function fetchReports(params?: Record<string, string>): Promise<ReportsData> {
  const qs = buildParams(params);
  const [statusBreakdown, slaData, counterpartyData, highValueData, declarations] = await Promise.all([
    api.get<Record<string, number>>(`/api/reports/status-breakdown${qs}`),
    api.get<SlaReportRow[]>(`/api/reports/sla${qs}`),
    api.get<CounterpartyReportRow[]>(`/api/reports/counterparty-concentration${qs}`),
    api.get<Array<HighValueSourceRow | HighValueSummaryRow>>(`/api/reports/high-value${qs}`),
    api.get<ReportDeclarationDto[]>(`/api/reports/list${qs}`),
  ]);
  const departments = [...new Set(declarations.map((d) => d.department).filter((department): department is string => Boolean(department)))].sort();
  return { statusBreakdown, slaData, counterpartyData, highValueData: normalizeHighValueRows(highValueData), declarations, departments };
}
