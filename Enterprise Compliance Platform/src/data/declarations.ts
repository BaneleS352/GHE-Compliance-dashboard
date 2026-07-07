import { Declaration } from "../types/declaration";

// ─── Seed declarations ──────────────────────────────────────────────────────────
export const declarations: Declaration[] = [
  { id: "GHE-2024-0047", employee: "Nomvula Dlamini", teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", Counterparty: "Tsogo Sun Hotels", value: 8500, submitted: "2024-11-12", approver: "Sipho Nkosi", status: "Pending", priority: "High", description: "Corporate dinner for key partners at Sandton Sun", relationship: "Client – Strategic Partner", receivedGiven: "Received", from: "Supplier", contactPerson: "John Smith", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-10", instances: "2", publicOfficial: "No" },
  { id: "GHE-2024-0046", employee: "Thabo Mokoena", teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Gift", Counterparty: "Makro", value: 1200, submitted: "2024-11-10", approver: "Sipho Nkosi", status: "Approved", priority: "Low", description: "End-of-year gift basket received from supplier", relationship: "Supplier – Regular", receivedGiven: "Received", from: "Supplier", contactPerson: "Jane Dube", biddingProcess: "No", occasion: "Festive", date: "2024-11-08", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0045", employee: "Ayanda Khumalo", teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Entertainment", Counterparty: "Emirates Airline", value: 34000, submitted: "2024-11-08", approver: "Lindiwe Zulu", status: "Escalated", priority: "High", description: "Business class flights and lounge access for conference", relationship: "Counterparty – Technology", receivedGiven: "Received", from: "Customer", contactPerson: "Ahmed Al-Rashid", biddingProcess: "Yes", occasion: "Other", date: "2024-11-05", instances: "3", publicOfficial: "No" },
  { id: "GHE-2024-0044", employee: "Pieter van der Berg", teamMemberNumber: "HB-156902", lineManager: "Lindiwe Zulu", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", Counterparty: "La Colombe Restaurant", value: 3200, submitted: "2024-11-06", approver: "Sipho Nkosi", status: "Declined", priority: "Medium", description: "Lunch meeting with audit consultants", relationship: "Service Provider – Annual", receivedGiven: "Given", from: "Customer", contactPerson: "Mark Johnson", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-04", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0043", employee: "Zanele Sithole", teamMemberNumber: "HB-198741", lineManager: "Sipho Nkosi", position: "HR Generalist", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", Counterparty: "Woolworths", value: 650, submitted: "2024-11-04", approver: "Lindiwe Zulu", status: "Approved", priority: "Low", description: "Festive season hamper from staffing agency", relationship: "Supplier – Staffing", receivedGiven: "Received", from: "Supplier", contactPerson: "Thandi Molefe", biddingProcess: "No", occasion: "Festive", date: "2024-11-02", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0042", employee: "Bongani Cele", teamMemberNumber: "HB-234512", lineManager: "Lindiwe Zulu", position: "IT Systems Lead", department: "IT", company: "Hollywoodbets Group", team: "Technology", type: "Entertainment", Counterparty: "Sun International", value: 12800, submitted: "2024-11-02", approver: "Sipho Nkosi", status: "Pending", priority: "Medium", description: "Golf day and networking event hosted by Sun International", relationship: "Counterparty – IT Solutions", receivedGiven: "Received", from: "Supplier", contactPerson: "Riaan Botha", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2024-10-31", instances: "2", publicOfficial: "No" },
  { id: "GHE-2024-0041", employee: "Fatima Ismail", teamMemberNumber: "HB-167823", lineManager: "Sipho Nkosi", position: "Legal Counsel", department: "Legal", company: "Hollywoodbets Group", team: "Legal & Compliance", type: "Gift", Counterparty: "Edgars", value: 890, submitted: "2024-10-30", approver: "Lindiwe Zulu", status: "Info Requested", priority: "Medium", description: "Clothing voucher received at legal conference", relationship: "External – Industry Event", receivedGiven: "Received", from: "Customer", contactPerson: "Priya Naidoo", biddingProcess: "N/A", occasion: "Other", date: "2024-10-28", instances: "1", publicOfficial: "No" },
  { id: "GHE-2024-0040", employee: "Siphamandla Ndlovu", teamMemberNumber: "HB-244001", lineManager: "Lindiwe Zulu", position: "Brand Strategist", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", Counterparty: "Radisson Blu", value: 5600, submitted: "2024-10-28", approver: "Sipho Nkosi", status: "Draft", priority: "Low", description: "Team dinner for campaign launch celebration", relationship: "Internal – Team Event", receivedGiven: "Given", from: "Team Member", contactPerson: "Lebo Mahlangu", biddingProcess: "No", occasion: "Milestone", date: "2024-10-25", instances: "1", publicOfficial: "No" },
];

// ─── Chart data ─────────────────────────────────────────────────────────────────
export const complianceTrend = [
  { month: "Jun", approved: 14, Declined: 4 },
  { month: "Jul", approved: 19, Declined: 5 },
  { month: "Aug", approved: 15, Declined: 4 },
  { month: "Sep", approved: 25, Declined: 6 },
  { month: "Oct", approved: 22, Declined: 6 },
  { month: "Nov", approved: 18, Declined: 4 },
];

export const typeBreakdown = [
  { name: "Gift",          value: 38, color: "#7c3aed" },
  { name: "Hospitality",   value: 41, color: "#0891b2" },
  { name: "Entertainment", value: 21, color: "#d97706" },
];

// ─── Approval options ───────────────────────────────────────────────────────────
export const approvalOptions = [
  { value: "return",     label: "Return - Team member to provide additional information." },
  { value: "accept",     label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
  { value: "org",        label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
  { value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
  { value: "decline",    label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
];
