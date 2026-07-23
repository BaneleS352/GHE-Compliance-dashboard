import { PURPLE } from "../../../config/theme";

export { Table } from "./Table";
export { Thead } from "./Thead";
export { Th } from "./Th";
export { Tbody } from "./Tbody";
export { Tr } from "./Tr";
export { Td } from "./Td";

// ─── Shared column style map (ApprovalQueue reference standard) ───

export const COL = {
  /** Declaration ID — wrap Td content in <span className={COL.ID} style={{ color: PURPLE }}> */
  ID: "font-mono text-sm font-bold",
  /** Type — renders via <TypeBadge> */
  TYPE: "",
  /** Counterparty — medium weight + foreground */
  COUNTERPARTY: "font-medium text-foreground",
  /** Monetary value — semibold + tabular-nums */
  VALUE: "font-semibold tabular-nums",
  /** Date string — tabular-nums + muted */
  SUBMITTED: "tabular-nums text-muted-foreground",
  /** Employee name — medium weight + foreground */
  EMPLOYEE: "font-medium text-foreground",
  /** Department or other muted label */
  DEPARTMENT: "text-muted-foreground",
  /** Final Approver or fallback muted label */
  APPROVER: "text-muted-foreground",
  /** Status — renders via <StatusBadge> */
  STATUS: "",
  /** Plain tabular-nums for counts & stats */
  TABULAR_NUMS: "tabular-nums",
  /** Muted text fallback */
  TEXT_MUTED: "text-muted-foreground",
  /** Employee/Dept fallback — medium weight */
  TEXT_MEDIUM: "font-medium text-foreground",
};
