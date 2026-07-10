import { Declaration, ComplianceTrendPoint, TypeBreakdownItem } from "../types/declaration";
import {
  getDeclarations,
  getDeclarationById,
  addDeclaration,
  updateDeclaration,
  getComplianceTrend,
  getTypeBreakdown,
} from "../data/db";

export async function fetchDeclarations(): Promise<Declaration[]> {
  return getDeclarations().sort((a, b) => b.submitted.localeCompare(a.submitted));
}

export async function fetchDeclarationById(id: string): Promise<Declaration> {
  const d = getDeclarationById(id);
  if (!d) throw new Error(`Declaration ${id} was not found.`);
  return d;
}

export async function createDeclaration(declaration: Declaration): Promise<Declaration> {
  return addDeclaration(declaration);
}

export async function updateDeclarationStatus(id: string, status: string): Promise<Declaration> {
  updateDeclaration(id, { status: status as Declaration["status"] });
  const d = getDeclarationById(id);
  if (!d) throw new Error(`Declaration ${id} was not found.`);
  return d;
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
  try {
    const res = await fetch(`${API_BASE}/declarations/stats`);
    if (!res.ok) throw new Error(`Failed to fetch dashboard stats: ${res.statusText}`);
    return res.json() as Promise<DashboardStats>;
  } catch {
    const declarations = getLocalDeclarations();
    return {
      kpis: {
        total: declarations.length,
        pending: declarations.filter((item) => item.status === "Pending").length,
        approved: declarations.filter((item) => item.status === "Approved").length,
        declined: declarations.filter((item) => item.status === "Declined").length,
        escalated: declarations.filter((item) => item.status === "Escalated").length,
        totalValue: declarations.reduce((sum, item) => sum + item.value, 0),
      },
      complianceTrend: fallbackComplianceTrend,
      typeBreakdown: fallbackTypeBreakdown,
    };
  }
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
    files:               raw.files,
  };
}

function toApiDeclaration(declaration: Declaration) {
  return {
    id:                  declaration.id,
    employee:            declaration.employee,
    teamMemberNumber:    declaration.teamMemberNumber,
    lineManager:         declaration.lineManager,
    position:            declaration.position,
    department:          declaration.department,
    company:             declaration.company,
    team:                declaration.team,
    type:                declaration.type,
    counterparty:        declaration.Counterparty,
    value:               declaration.value,
    submitted:           declaration.submitted,
    approver:            declaration.approver,
    status:              declaration.status,
    priority:            declaration.priority,
    description:         declaration.description,
    relationship:        declaration.relationship,
    receivedGiven:       declaration.receivedGiven,
    from:                declaration.from,
    contactPerson:       declaration.contactPerson,
    biddingProcess:      declaration.biddingProcess,
    contractNegotiation: declaration.contractNegotiation,
    occasion:            declaration.occasion,
    date:                declaration.date,
    instances:           declaration.instances,
    publicOfficial:      declaration.publicOfficial,
    substantiation:      declaration.substantiation,
    files:               declaration.files,
  };
}
