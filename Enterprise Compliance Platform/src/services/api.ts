import { Declaration } from "../types/declaration";

// Base URL for the backend API — port matches launchSettings.json http profile
const API_BASE = "http://localhost:5202/api";

// ─────────────────────────────────────────────────────────────────────────────
//  Declarations
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDeclarations(): Promise<Declaration[]> {
  const res = await fetch(`${API_BASE}/declarations`);
  if (!res.ok) throw new Error(`Failed to fetch declarations: ${res.statusText}`);
  const data: unknown[] = await res.json();
  // Map camelCase API response to our Declaration shape
  return data.map(mapDeclaration);
}

export async function fetchDeclarationById(id: string): Promise<Declaration> {
  const res = await fetch(`${API_BASE}/declarations/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`Failed to fetch declaration ${id}: ${res.statusText}`);
  return mapDeclaration(await res.json());
}

export async function updateDeclarationStatus(
  id: string,
  status: string
): Promise<Declaration> {
  const res = await fetch(`${API_BASE}/declarations/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(`Failed to update status: ${res.statusText}`);
  return mapDeclaration(await res.json());
}

// ─────────────────────────────────────────────────────────────────────────────
//  Dashboard stats
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceTrendPoint {
  month: string;
  approved: number;
  Declined: number;
}

export interface TypeBreakdownItem {
  name: string;
  value: number;
  color: string;
}

export interface DashboardStats {
  kpis: {
    total: number;
    pending: number;
    approved: number;
    declined: number;
    escalated: number;
    totalValue: number;
  };
  complianceTrend: ComplianceTrendPoint[];
  typeBreakdown: TypeBreakdownItem[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${API_BASE}/declarations/stats`);
  if (!res.ok) throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
  return res.json() as Promise<DashboardStats>;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Mapper: camelCase API → Declaration type
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeclaration(raw: any): Declaration {
  return {
    id:                  raw.id,
    employee:            raw.employee,
    teamMemberNumber:    raw.teamMemberNumber,
    lineManager:         raw.lineManager,
    position:            raw.position,
    department:          raw.department,
    company:             raw.company,
    team:                raw.team,
    type:                raw.type,
    Counterparty:        raw.counterparty,   // backend sends camelCase
    value:               raw.value,
    submitted:           raw.submitted,
    approver:            raw.approver,
    status:              raw.status,
    priority:            raw.priority,
    description:         raw.description,
    relationship:        raw.relationship,
    receivedGiven:       raw.receivedGiven,
    from:                raw.from,
    contactPerson:       raw.contactPerson,
    biddingProcess:      raw.biddingProcess,
    contractNegotiation: raw.contractNegotiation,
    occasion:            raw.occasion,
    date:                raw.date,
    instances:           raw.instances,
    publicOfficial:      raw.publicOfficial,
    substantiation:      raw.substantiation,
  };
}
