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
  const declarations = getDeclarations();
  return {
    kpis: {
      total: declarations.length,
      pending: declarations.filter((item) => item.status === "Pending").length,
      approved: declarations.filter((item) => item.status === "Approved").length,
      declined: declarations.filter((item) => item.status === "Declined").length,
      escalated: declarations.filter((item) => item.status === "Escalated").length,
      totalValue: declarations.reduce((sum, item) => sum + item.value, 0),
    },
    complianceTrend: getComplianceTrend(),
    typeBreakdown: getTypeBreakdown(),
  };
}
