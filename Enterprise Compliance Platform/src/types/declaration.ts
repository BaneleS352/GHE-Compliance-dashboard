// ─── Domain types ──────────────────────────────────────────────────────────────

export type Screen =
  | "landing"
  | "login"
  | "new-declaration"
  | "my-declarations"
  | "approver-dashboard"
  | "approval-queue"
  | "approval-detail"
  | "declaration-detail";

export type Role = "teamMember" | "approver";

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

export interface Declaration {
  id: string;
  employee: string;
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
}

export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  url: string;
}
