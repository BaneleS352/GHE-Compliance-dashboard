import { Declaration } from "../types/declaration";
import {
  complianceTrend as fallbackComplianceTrend,
  declarations as seedDeclarations,
  typeBreakdown as fallbackTypeBreakdown,
} from "../data/declarations";

// Base URL for the backend API — port matches launchSettings.json http profile
const API_BASE = "http://localhost:5202/api";
const LOCAL_DECLARATIONS_KEY = "ghe.localDeclarations";

// ─────────────────────────────────────────────────────────────────────────────
//  Declarations
// ─────────────────────────────────────────────────────────────────────────────

export async function fetchDeclarations(): Promise<Declaration[]> {
  try {
    const res = await fetch(`${API_BASE}/declarations`);
    if (!res.ok) throw new Error(`Failed to fetch declarations: ${res.statusText}`);
    const data: unknown[] = await res.json();
    return data.map(mapDeclaration);
  } catch {
    return getLocalDeclarations();
  }
}

export async function fetchDeclarationById(id: string): Promise<Declaration> {
  try {
    const res = await fetch(`${API_BASE}/declarations/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Failed to fetch declaration ${id}: ${res.statusText}`);
    return mapDeclaration(await res.json());
  } catch {
    const declaration = getLocalDeclarations().find((item) => item.id === id);
    if (!declaration) throw new Error(`Declaration ${id} was not found.`);
    return declaration;
  }
}

export async function createDeclaration(
  declaration: Declaration
): Promise<Declaration> {
  try {
    const res = await fetch(`${API_BASE}/declarations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toApiDeclaration(declaration)),
    });
    if (!res.ok) throw new Error(`Failed to submit declaration: ${res.statusText}`);
    return mapDeclaration(await res.json());
  } catch {
    saveLocalDeclaration(declaration);
    return declaration;
  }
}

export async function updateDeclarationStatus(
  id: string,
  status: string
): Promise<Declaration> {
  try {
    const res = await fetch(`${API_BASE}/declarations/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to update status: ${res.statusText}`);
    return mapDeclaration(await res.json());
  } catch {
    const declarations = getLocalDeclarations();
    const declaration = declarations.find((item) => item.id === id);
    if (!declaration) throw new Error(`Declaration ${id} was not found.`);
    declaration.status = status as Declaration["status"];
    setStoredDeclarations(declarations);
    return declaration;
  }
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

function getLocalDeclarations(): Declaration[] {
  const stored = getStoredDeclarations();
  const storedIds = new Set(stored.map((item) => item.id));
  return [
    ...stored,
    ...seedDeclarations.filter((item) => !storedIds.has(item.id)),
  ].sort((a, b) => b.submitted.localeCompare(a.submitted));
}

function saveLocalDeclaration(declaration: Declaration) {
  const declarations = getStoredDeclarations().filter((item) => item.id !== declaration.id);
  setStoredDeclarations([declaration, ...declarations]);
}

function getStoredDeclarations(): Declaration[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_DECLARATIONS_KEY);
    return raw ? JSON.parse(raw) as Declaration[] : [];
  } catch {
    return [];
  }
}

function setStoredDeclarations(declarations: Declaration[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_DECLARATIONS_KEY, JSON.stringify(declarations));
}
