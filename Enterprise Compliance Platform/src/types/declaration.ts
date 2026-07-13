export type Screen =
  | "landing"
  | "login"
  | "new-declaration"
  | "my-declarations"
  | "approver-dashboard"
  | "approval-queue"
  | "approval-detail"
  | "declaration-detail"
  | "admin-dashboard"
  | "admin-users"
  | "admin-workflows"
  | "admin-config"
  | "admin-dropdowns"
  | "admin-reports";

export type Role = "teamMember" | "approver" | "admin";

export type StatusType =
  | "Draft"
  | "Pending"
  | "Approved"
  | "Declined"
  | "Escalated"
  | "Info Requested";

export type ApprovalDecision =
  | "return"
  | "accept"
  | "org"
  | "foundation"
  | "decline"
  | null;

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  teamMemberNumber: string;
  department: string;
  position: string;
  lineManager: string | null;
}

export interface Declaration {
  id: string;
  employee: string;
  employeeId?: string;
  department: string;
  type: string;
  Counterparty: string;
  value: number;
  submitted: string;
  approver: string;
  status: StatusType;
  priority: "High" | "Medium" | "Low";
  description: string;
  relationship: string;
  teamMemberNumber: string;
  lineManager: string;
  position: string;
  receivedGiven: string;
  from: string;
  contactPerson: string;
  biddingProcess: string;
  contractNegotiation?: string;
  occasion: string;
  date: string;
  instances: string;
  publicOfficial: string;
  company?: string;
  team?: string;
  substantiation?: string;
  files?: UploadedFile[];
}

export interface WorkflowStep {
  order: number;
  role: "lineManager" | "hr" | "ceo";
  assignee: string;
  assigneeName: string;
  label: string;
  status: "pending" | "approved" | "declined" | "returned";
  decision: ApprovalDecision;
  notes: string;
  decidedAt: string | null;
}

export interface WorkflowInstance {
  declarationId: string;
  steps: WorkflowStep[];
}

export interface WorkflowRule {
  id: string;
  name: string;
  condition: string;
  priority: number;
  steps: { order: number; role: "lineManager" | "hr" | "ceo"; label: string }[];
}

export interface SystemConfig {
  highValueThreshold: number;
  mediumValueThreshold: number;
  slaEscalationDays: number;
  maxDeclarationsPerCounterparty: number;
  emailTemplate: string;
}

export interface Dropdowns {
  departments: string[];
  categories: string[];
  occasions: string[];
  receivedGiven: string[];
  biddingProcess: string[];
  publicOfficial: string[];
  relationships: string[];
  partyTypes: string[];
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
  data?: string;
}

export interface ComplianceTrendPoint {
  month: string;
  approved: number;
  declined: number;
}

export interface TypeBreakdownItem {
  name: string;
  value: number;
  color: string;
}
