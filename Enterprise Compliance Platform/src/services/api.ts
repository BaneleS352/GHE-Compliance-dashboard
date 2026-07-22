import { Declaration, ComplianceTrendPoint, TypeBreakdownItem } from "../types/declaration";
import { api } from "./httpClient";

export async function fetchDeclarations(status?: string, search?: string): Promise<Declaration[]> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  const qs = params.toString();
  const raw = await api.get<any[]>(`/api/declarations${qs ? `?${qs}` : ""}`);
  return raw.map(mapDeclaration);
}

export async function fetchDeclarationById(id: string): Promise<Declaration> {
  const raw = await api.get<any>(`/api/declarations/${id}`);
  return mapDeclaration(raw);
}

export async function createDeclaration(declaration: Declaration): Promise<Declaration> {
  const raw = await api.post<any>("/api/declarations", toApiDeclaration(declaration));
  return mapDeclaration(raw);
}

export async function updateDeclaration(id: string, data: Partial<Declaration>): Promise<Declaration> {
  const raw = await api.put<any>(`/api/declarations/${id}`, toApiDeclaration(data as Declaration));
  return mapDeclaration(raw);
}

export async function updateDeclarationStatus(id: string, status: string): Promise<Declaration> {
  const raw = await api.patch<any>(`/api/declarations/${id}/status`, { status });
  return mapDeclaration(raw);
}

export async function submitDeclaration(id: string): Promise<Declaration> {
  const raw = await api.patch<any>(`/api/declarations/${id}/submit`);
  return mapDeclaration(raw);
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
  return api.get<DashboardStats>("/api/declarations/stats");
}

function mapDeclaration(raw: any): Declaration {
  return {
    id:                  raw.id,
    employee:            raw.employee,
    employeeId:          raw.employeeId,
    teamMemberNumber:    raw.teamMemberNumber,
    lineManager:         raw.lineManager,
    position:            raw.position,
    department:          raw.department,
    company:             raw.company,
    team:                raw.team,
    type:                raw.type,
    Counterparty:        raw.counterparty,
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

// ── Admin: Users ─────────────────────────────────────
export async function fetchUsers(search?: string, role?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (role) params.set("role", role);
  const qs = params.toString();
  return api.get<any[]>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export async function fetchUserById(id: string): Promise<any> {
  return api.get<any>(`/api/users/${id}`);
}

export async function createUser(data: any): Promise<any> {
  return api.post<any>("/api/admin/users", data);
}

export async function updateUser(id: string, data: any): Promise<any> {
  return api.put<any>(`/api/admin/users/${id}`, data);
}

export async function deleteUser(id: string): Promise<any> {
  return api.del<any>(`/api/admin/users/${id}`);
}

// ── Admin: Config ─────────────────────────────────────
export async function fetchConfig(): Promise<any> {
  return api.get<any>("/api/admin/config");
}

export async function saveConfig(data: any): Promise<any> {
  return api.put<any>("/api/admin/config", data);
}

// ── Admin: Dropdowns ──────────────────────────────────
export async function fetchDropdowns(): Promise<any> {
  return api.get<any>("/api/admin/config/dropdowns");
}

export async function updateDropdowns(data: any): Promise<any> {
  return api.put<any>("/api/admin/config/dropdowns", data);
}

// ── Admin: Dashboard ──────────────────────────────────
export async function fetchAdminDashboard(): Promise<any> {
  return api.get<any>("/api/admin/dashboard");
}

// ── Admin: Workflow Rules ─────────────────────────────
export async function fetchWorkflowRules(): Promise<any[]> {
  return api.get<any[]>("/api/admin/workflows/rules");
}

export async function createWorkflowRule(data: any): Promise<any> {
  return api.post<any>("/api/admin/workflows/rules", data);
}

export async function updateWorkflowRule(id: string, data: any): Promise<any> {
  return api.put<any>(`/api/admin/workflows/rules/${id}`, data);
}

export async function deleteWorkflowRule(id: string): Promise<any> {
  return api.del<any>(`/api/admin/workflows/rules/${id}`);
}

// ── Workflows ─────────────────────────────────────────
export async function fetchPendingWorkflows(): Promise<any[]> {
  const raw = await api.get<any[]>("/api/workflows/pending");
  return raw.map((item) => ({
    ...item,
    declaration: mapDeclaration(item.declaration),
  }));
}

export async function fetchWorkflowInstance(declarationId: string): Promise<any> {
  return api.get<any>(`/api/workflows/instances/${declarationId}`);
}

export async function approveWorkflowStep(data: {
  declarationId: string;
  decision: string;
  notes?: string;
}): Promise<any> {
  return api.post<any>("/api/workflows/approve", data);
}

// ── Reports ───────────────────────────────────────────
export async function fetchReportStatusBreakdown(params?: Record<string, string>): Promise<any> {
  return api.get<any>(`/api/reports/status-breakdown${params ? `?${new URLSearchParams(params)}` : ""}`);
}

export async function fetchReportSLA(params?: Record<string, string>): Promise<any[]> {
  return api.get<any[]>(`/api/reports/sla${params ? `?${new URLSearchParams(params)}` : ""}`);
}

export async function fetchReportCounterpartyConcentration(params?: Record<string, string>): Promise<any[]> {
  return api.get<any[]>(`/api/reports/counterparty-concentration${params ? `?${new URLSearchParams(params)}` : ""}`);
}

export async function fetchReportHighValue(): Promise<any[]> {
  return api.get<any[]>("/api/reports/high-value");
}

export async function fetchReportList(params?: Record<string, string>): Promise<any[]> {
  return api.get<any[]>(`/api/reports/list${params ? `?${new URLSearchParams(params)}` : ""}`);
}

// ── Approval Options ──────────────────────────────────
export async function fetchApprovalOptions(): Promise<any[]> {
  return api.get<any[]>("/api/admin/config/approval-options");
}
export async function createApprovalOption(data: { id: string; value: string; label: string }): Promise<any> {
  return api.post<any>("/api/admin/config/approval-options", data);
}
export async function updateApprovalOption(id: string, data: { value: string; label: string }): Promise<any> {
  return api.put<any>(`/api/admin/config/approval-options/${id}`, data);
}
export async function deleteApprovalOption(id: string): Promise<any> {
  return api.del<any>(`/api/admin/config/approval-options/${id}`);
}

function toApiDeclaration(declaration: Partial<Declaration>) {
  return {
    ...(declaration.id !== undefined && { id: declaration.id }),
    ...(declaration.employee !== undefined && { employee: declaration.employee }),
    ...(declaration.employeeId !== undefined && { employeeId: declaration.employeeId }),
    ...(declaration.teamMemberNumber !== undefined && { teamMemberNumber: declaration.teamMemberNumber }),
    ...(declaration.lineManager !== undefined && { lineManager: declaration.lineManager }),
    ...(declaration.position !== undefined && { position: declaration.position }),
    ...(declaration.department !== undefined && { department: declaration.department }),
    ...(declaration.company !== undefined && { company: declaration.company }),
    ...(declaration.team !== undefined && { team: declaration.team }),
    ...(declaration.type !== undefined && { type: declaration.type }),
    ...(declaration.Counterparty !== undefined && { counterparty: declaration.Counterparty }),
    ...(declaration.value !== undefined && { value: declaration.value }),
    ...(declaration.submitted !== undefined && { submitted: declaration.submitted }),
    ...(declaration.approver !== undefined && { approver: declaration.approver }),
    ...(declaration.status !== undefined && { status: declaration.status }),
    ...(declaration.priority !== undefined && { priority: declaration.priority }),
    ...(declaration.description !== undefined && { description: declaration.description }),
    ...(declaration.relationship !== undefined && { relationship: declaration.relationship }),
    ...(declaration.receivedGiven !== undefined && { receivedGiven: declaration.receivedGiven }),
    ...(declaration.from !== undefined && { from: declaration.from }),
    ...(declaration.contactPerson !== undefined && { contactPerson: declaration.contactPerson }),
    ...(declaration.biddingProcess !== undefined && { biddingProcess: declaration.biddingProcess }),
    ...(declaration.contractNegotiation !== undefined && { contractNegotiation: declaration.contractNegotiation }),
    ...(declaration.occasion !== undefined && { occasion: declaration.occasion }),
    ...(declaration.date !== undefined && { date: declaration.date }),
    ...(declaration.instances !== undefined && { instances: declaration.instances }),
    ...(declaration.publicOfficial !== undefined && { publicOfficial: declaration.publicOfficial }),
    ...(declaration.substantiation !== undefined && { substantiation: declaration.substantiation }),
    ...(declaration.files !== undefined && { files: declaration.files }),
  };
}
