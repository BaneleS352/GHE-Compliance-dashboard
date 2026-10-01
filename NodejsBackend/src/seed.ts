import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "password";
const SALT_ROUNDS = 10;

const organizations = [
  { id: 1n, name: "Hollywoodbets Group", shortCode: "HB" },
  { id: 2n, name: "Naspers Limited", shortCode: "NPN" },
];

// Numeric fixture keys (seed writes the normalized model directly; no
// legacy identifier reaches the database).
const users = [
  // Hollywoodbets Group (org 1)
  { id: 1n, name: "Nomvula Dlamini", email: "nomvula@hb.co.za", role: "teamMember", teamMemberNumber: "HB-204478", department: "Marketing", position: "Senior Brand Manager", lineManager: "Sipho Nkosi", managerId: 3n, organizationId: 1n },
  { id: 2n, name: "Thabo Mokoena", email: "thabo@hb.co.za", role: "teamMember", teamMemberNumber: "HB-187234", department: "Sales", position: "Sales Executive", lineManager: "Lindiwe Zulu", managerId: 4n, organizationId: 1n },
  { id: 3n, name: "Sipho Nkosi", email: "sipho@hb.co.za", role: "approver", teamMemberNumber: "HB-10001", department: "Marketing", position: "Line Manager", lineManager: null, managerId: null, organizationId: 1n },
  { id: 4n, name: "Lindiwe Zulu", email: "lindiwe@hb.co.za", role: "approver", teamMemberNumber: "HB-10002", department: "HR", position: "Head of HR", lineManager: null, managerId: null, organizationId: null },
  { id: 5n, name: "System Admin", email: "admin@hb.co.za", role: "admin", teamMemberNumber: "HB-00000", department: "IT", position: "System Administrator", lineManager: null, managerId: null, organizationId: null },
  { id: 6n, name: "Pieter van der Berg", email: "pieter@hb.co.za", role: "teamMember", teamMemberNumber: "HB-156902", department: "Finance", position: "Finance Analyst", lineManager: "Sipho Nkosi", managerId: 3n, organizationId: 1n },
  { id: 7n, name: "Ayanda Khumalo", email: "ayanda@hb.co.za", role: "teamMember", teamMemberNumber: "HB-219033", department: "Operations", position: "Operations Manager", lineManager: "Sipho Nkosi", managerId: 3n, organizationId: 1n },
  { id: 8n, name: "Zanele Sithole", email: "zanele@hb.co.za", role: "teamMember", teamMemberNumber: "HB-198741", department: "HR", position: "HR Generalist", lineManager: "Sipho Nkosi", managerId: 3n, organizationId: 1n },
  { id: 9n, name: "Bongani Cele", email: "bongani@hb.co.za", role: "teamMember", teamMemberNumber: "HB-234512", department: "IT", position: "IT Systems Lead", lineManager: "Lindiwe Zulu", managerId: 4n, organizationId: 1n },
  { id: 10n, name: "Fatima Ismail", email: "fatima@hb.co.za", role: "teamMember", teamMemberNumber: "HB-167823", department: "Legal", position: "Legal Counsel", lineManager: "Sipho Nkosi", managerId: 3n, organizationId: 1n },
  { id: 11n, name: "Siphamandla Ndlovu", email: "siphamandla@hb.co.za", role: "teamMember", teamMemberNumber: "HB-244001", department: "Marketing", position: "Brand Strategist", lineManager: "Lindiwe Zulu", managerId: 4n, organizationId: 1n },
  // Naspers Limited (org 2)
  { id: 12n, name: "James van Wyk", email: "james@npn.co.za", role: "approver", teamMemberNumber: "NPN-10001", department: "Engineering", position: "Line Manager", lineManager: null, managerId: null, organizationId: 2n },
  { id: 13n, name: "Aisha Patel", email: "aisha@npn.co.za", role: "approver", teamMemberNumber: "NPN-10002", department: "HR", position: "Head of HR", lineManager: null, managerId: null, organizationId: 2n },
  { id: 14n, name: "Kabelo Molefe", email: "kabelo@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20001", department: "Engineering", position: "Software Engineer", lineManager: "James van Wyk", managerId: 12n, organizationId: 2n },
  { id: 15n, name: "Nomsa Dlamini", email: "nomsa@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20002", department: "Finance", position: "Financial Controller", lineManager: "James van Wyk", managerId: 12n, organizationId: 2n },
  { id: 16n, name: "Ravi Sharma", email: "ravi@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20003", department: "Marketing", position: "Marketing Manager", lineManager: "James van Wyk", managerId: 12n, organizationId: 2n },
  { id: 17n, name: "Lebo Mokoena", email: "lebo@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20004", department: "Legal", position: "Legal Advisor", lineManager: "Aisha Patel", managerId: 13n, organizationId: 2n },
  { id: 18n, name: "Sipho Ndlovu", email: "sipho.n@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20005", department: "Operations", position: "Operations Lead", lineManager: "James van Wyk", managerId: 12n, organizationId: 2n },
  { id: 19n, name: "Fatima Jacobs", email: "fatima.j@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20006", department: "IT", position: "IT Manager", lineManager: "Aisha Patel", managerId: 13n, organizationId: 2n },
  { id: 20n, name: "Thabo Zulu", email: "thabo.z@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20007", department: "Sales", position: "Sales Director", lineManager: "James van Wyk", managerId: 12n, organizationId: 2n },
  { id: 21n, name: "Admin NPN", email: "admin@npn.co.za", role: "admin", teamMemberNumber: "NPN-00000", department: "IT", position: "System Administrator", lineManager: null, managerId: null, organizationId: 2n },
];

const declarations = [
  // Hollywoodbets Group declarations
  { id: "GHE-2024-0047", employee: "Nomvula Dlamini", employeeId: 1n, teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Tsogo Sun Hotels", value: 8500, submitted: "2024-11-12", approver: "Sipho Nkosi", approverId: 3n, status: "Pending", priority: "High", description: "Corporate dinner for key partners at Sandton Sun", relationship: "Client \u2013 Strategic Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John Smith", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-10", instances: "2", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0046", employee: "Thabo Mokoena", employeeId: 2n, teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Gift", counterparty: "Makro", value: 1200, submitted: "2024-11-10", approver: "Lindiwe Zulu", approverId: 4n, status: "Approved", priority: "Low", description: "End-of-year gift basket received from supplier", relationship: "Supplier \u2013 Regular", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Jane Dube", biddingProcess: "No", occasion: "Festive", date: "2024-11-08", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0045", employee: "Ayanda Khumalo", employeeId: 7n, teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Entertainment", counterparty: "Emirates Airline", value: 34000, submitted: "2024-11-08", approver: "Sipho Nkosi", approverId: 3n, status: "Pending", priority: "High", description: "Business class flights and lounge access for conference", relationship: "Counterparty \u2013 Technology", receivedGiven: "Received", fromField: "Customer", contactPerson: "Ahmed Al-Rashid", biddingProcess: "Yes", occasion: "Other", date: "2024-11-05", instances: "3", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0044", employee: "Pieter van der Berg", employeeId: 6n, teamMemberNumber: "HB-156902", lineManager: "Sipho Nkosi", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", counterparty: "La Colombe Restaurant", value: 3200, submitted: "2024-11-06", approver: "Sipho Nkosi", approverId: 3n, status: "Pending", priority: "Medium", description: "Lunch meeting with audit consultants", relationship: "Service Provider \u2013 Annual", receivedGiven: "Given", fromField: "Customer", contactPerson: "Mark Johnson", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-04", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0043", employee: "Zanele Sithole", employeeId: 8n, teamMemberNumber: "HB-198741", lineManager: "Sipho Nkosi", position: "HR Generalist", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", counterparty: "Woolworths", value: 650, submitted: "2024-11-04", approver: "Lindiwe Zulu", approverId: 4n, status: "Approved", priority: "Low", description: "Festive season hamper from staffing agency", relationship: "Supplier \u2013 Staffing", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Thandi Molefe", biddingProcess: "No", occasion: "Festive", date: "2024-11-02", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0042", employee: "Bongani Cele", employeeId: 9n, teamMemberNumber: "HB-234512", lineManager: "Lindiwe Zulu", position: "IT Systems Lead", department: "IT", company: "Hollywoodbets Group", team: "Technology", type: "Entertainment", counterparty: "Sun International", value: 12800, submitted: "2024-11-02", approver: "Lindiwe Zulu", approverId: 4n, status: "Pending", priority: "Medium", description: "Golf day and networking event hosted by Sun International", relationship: "Counterparty \u2013 IT Solutions", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Riaan Botha", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2024-10-31", instances: "2", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0041", employee: "Fatima Ismail", employeeId: 10n, teamMemberNumber: "HB-167823", lineManager: "Sipho Nkosi", position: "Legal Counsel", department: "Legal", company: "Hollywoodbets Group", team: "Legal & Compliance", type: "Gift", counterparty: "Edgars", value: 890, submitted: "2024-10-30", approver: "Lindiwe Zulu", approverId: 4n, status: "Returned", priority: "Medium", description: "Clothing voucher received at legal conference", relationship: "External \u2013 Industry Event", receivedGiven: "Received", fromField: "Customer", contactPerson: "Priya Naidoo", biddingProcess: "N/A", occasion: "Other", date: "2024-10-28", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2024-0040", employee: "Siphamandla Ndlovu", employeeId: 11n, teamMemberNumber: "HB-244001", lineManager: "Lindiwe Zulu", position: "Brand Strategist", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Radisson Blu", value: 5600, submitted: "2024-10-28", approver: "Lindiwe Zulu", approverId: 4n, status: "Draft", priority: "Low", description: "Team dinner for campaign launch celebration", relationship: "Internal \u2013 Team Event", receivedGiven: "Given", fromField: "Team Member", contactPerson: "Lebo Mahlangu", biddingProcess: "No", occasion: "Milestone", date: "2024-10-25", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0011", employee: "Nomvula Dlamini", employeeId: 1n, teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Gift", counterparty: "Nike SA", value: 1500, submitted: "2025-06-15", approver: "Lindiwe Zulu", approverId: 4n, status: "Pending", priority: "Low", description: "Promotional merchandise received at a brand activation event", relationship: "Supplier \u2013 Marketing", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Mike Brown", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-14", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0010", employee: "Thabo Mokoena", employeeId: 2n, teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Entertainment", counterparty: "Vodacom SA", value: 4500, submitted: "2025-06-12", approver: "Lindiwe Zulu", approverId: 4n, status: "Pending", priority: "Medium", description: "Client dinner and tickets to Springbok match at Loftus Versfeld", relationship: "Client \u2013 Key Account", receivedGiven: "Received", fromField: "Customer", contactPerson: "Thabo Mokoena", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2025-06-10", instances: "2", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0009", employee: "Nomvula Dlamini", employeeId: 1n, teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Southern Sun", value: 2200, submitted: "2025-06-08", approver: "Lindiwe Zulu", approverId: 4n, status: "Approved", priority: "Low", description: "Overnight accommodation for conference attendance", relationship: "Supplier \u2013 Hospitality", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Nomsa Khumalo", biddingProcess: "No", occasion: "Milestone", date: "2025-06-07", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0008", employee: "Ayanda Khumalo", employeeId: 7n, teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Gift", counterparty: "Deloitte SA", value: 800, submitted: "2025-06-05", approver: "Lindiwe Zulu", approverId: 4n, status: "Pending", priority: "Low", description: "Corporate gift basket sent to audit team as appreciation", relationship: "Service Provider \u2013 Annual Audit", receivedGiven: "Given", fromField: "Customer", contactPerson: "Sarah van Wyk", biddingProcess: "No", occasion: "Festive Season", date: "2025-06-03", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0007", employee: "Pieter van der Berg", employeeId: 6n, teamMemberNumber: "HB-156902", lineManager: "Sipho Nkosi", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", counterparty: "Standard Bank", value: 3800, submitted: "2025-06-01", approver: "Sipho Nkosi", approverId: 3n, status: "Pending", priority: "Medium", description: "Working lunch with banking partners to discuss credit facilities", relationship: "Banking Partner", receivedGiven: "Given", fromField: "Customer", contactPerson: "Peter Mkhize", biddingProcess: "Yes", occasion: "Business Meeting", date: "2025-05-30", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0020", employee: "Lindiwe Zulu", employeeId: 4n, teamMemberNumber: "HB-10002", lineManager: "Sipho Nkosi", position: "Head of HR", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Hospitality", counterparty: "The Campus Honeydew", value: 1800, submitted: "2025-06-18", approver: "Sipho Nkosi", approverId: 3n, status: "Pending", priority: "Low", description: "HR leadership offsite venue booking", relationship: "Venue Provider", receivedGiven: "Given", fromField: "Supplier", contactPerson: "Naledi Mokoena", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-17", instances: "1", publicOfficial: "No", organizationId: 1n },
  { id: "GHE-2025-0021", employee: "Lindiwe Zulu", employeeId: 4n, teamMemberNumber: "HB-10002", lineManager: "Sipho Nkosi", position: "Head of HR", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", counterparty: "Clicks", value: 320, submitted: "2025-06-20", approver: "Sipho Nkosi", approverId: 3n, status: "Approved", priority: "Low", description: "Wellness gift for long-serving employee", relationship: "Retailer", receivedGiven: "Given", fromField: "Supplier", contactPerson: "Kgomotso Mokoena", biddingProcess: "No", occasion: "Milestone", date: "2025-06-19", instances: "1", publicOfficial: "No", organizationId: 1n },
  // Naspers Limited declarations
  { id: "GHE-NPN-0001", employee: "Kabelo Molefe", employeeId: 14n, teamMemberNumber: "NPN-20001", lineManager: "James van Wyk", position: "Software Engineer", department: "Engineering", company: "Naspers Limited", team: "Platform Engineering", type: "Gift", counterparty: "Microsoft SA", value: 750, submitted: "2025-06-10", approver: "James van Wyk", approverId: 12n, status: "Pending", priority: "Low", description: "Developer conference swag bag", relationship: "Technology Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Liam O'Brien", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-09", instances: "1", publicOfficial: "No", organizationId: 2n },
  { id: "GHE-NPN-0002", employee: "Nomsa Dlamini", employeeId: 15n, teamMemberNumber: "NPN-20002", lineManager: "James van Wyk", position: "Financial Controller", department: "Finance", company: "Naspers Limited", team: "Group Finance", type: "Hospitality", counterparty: "KPMG", value: 4200, submitted: "2025-06-12", approver: "James van Wyk", approverId: 12n, status: "Pending", priority: "Medium", description: "Audit closing dinner at The Saxon Hotel", relationship: "Audit Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "David Nkosi", biddingProcess: "Yes", occasion: "Milestone", date: "2025-06-11", instances: "1", publicOfficial: "No", organizationId: 2n },
  { id: "GHE-NPN-0003", employee: "Ravi Sharma", employeeId: 16n, teamMemberNumber: "NPN-20003", lineManager: "James van Wyk", position: "Marketing Manager", department: "Marketing", company: "Naspers Limited", team: "Group Marketing", type: "Entertainment", counterparty: "SuperSport", value: 12500, submitted: "2025-06-15", approver: "Aisha Patel", approverId: 13n, status: "Pending", priority: "High", description: "VIP box at Champions League final screening", relationship: "Media Partner", receivedGiven: "Received", fromField: "Customer", contactPerson: "Mark Richards", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2025-06-14", instances: "2", publicOfficial: "No", organizationId: 2n },
  { id: "GHE-NPN-0004", employee: "Lebo Mokoena", employeeId: 17n, teamMemberNumber: "NPN-20004", lineManager: "Aisha Patel", position: "Legal Advisor", department: "Legal", company: "Naspers Limited", team: "Group Legal", type: "Gift", counterparty: "Webber Wentzel", value: 2200, submitted: "2025-06-18", approver: "James van Wyk", approverId: 12n, status: "Draft", priority: "Low", description: "Law firm anniversary gift received at legal summit", relationship: "External \u2013 Industry Event", receivedGiven: "Received", fromField: "Customer", contactPerson: "Adv. Mthethwa", biddingProcess: "No", occasion: "Other", date: "2025-06-17", instances: "1", publicOfficial: "No", organizationId: 2n },
  { id: "GHE-NPN-0005", employee: "Sipho Ndlovu", employeeId: 18n, teamMemberNumber: "NPN-20005", lineManager: "James van Wyk", position: "Operations Lead", department: "Operations", company: "Naspers Limited", team: "Group Operations", type: "Hospitality", counterparty: "Gautrain", value: 650, submitted: "2025-06-20", approver: "James van Wyk", approverId: 12n, status: "Approved", priority: "Low", description: "Executive transport service for board meeting", relationship: "Service Provider", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Busisiwe Mkhize", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-19", instances: "1", publicOfficial: "No", organizationId: 2n },
];

const workflowRules = [
  { id: 1n, name: "Low Value (R0–R1000)", condition: "low", priority: 1 },
  { id: 2n, name: "High Value (above R1000)", condition: "high", priority: 2 },
];

const workflowRuleSteps = [
  { ruleId: 1n, order: 1, role: "lineManager", label: "Line Manager Review" },
  { ruleId: 2n, order: 1, role: "lineManager", label: "Line Manager Review" },
  { ruleId: 2n, order: 2, role: "hr", label: "HR Review" },
];

const workflowInstances: { declarationId: string; steps: string }[] = [
  { declarationId: "GHE-2024-0047", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0045", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0044", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0042", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0011", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0010", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0008", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0007", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0009", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved. Reasonable expense for conference attendance.", decidedAt: "2025-06-09T10:30:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2025-06-10T14:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0020", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0021", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved by line manager.", decidedAt: "2025-06-20T09:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2025-06-20T11:30:00.000Z", decidedById: null, decidedByName: null }]) },
  // Missing Approved/Returned instances (H6)
  { declarationId: "GHE-2024-0046", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 4, assigneeName: "Lindiwe Zulu", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2024-11-11T10:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2024-11-11T14:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0043", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2024-11-05T09:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0041", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 3, assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved by LM.", decidedAt: "2024-10-29T10:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 4, assigneeName: "Lindiwe Zulu", label: "HR Review", status: "returned", decision: "return", notes: "Need more detail", decidedAt: "2024-10-30T10:00:00.000Z", decidedById: null, decidedByName: null }]) },
  // Naspers Limited workflow instances
  { declarationId: "GHE-NPN-0001", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 12, assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }] ) },
  { declarationId: "GHE-NPN-0002", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 12, assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 13, assigneeName: "Aisha Patel", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-NPN-0003", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 12, assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: 13, assigneeName: "Aisha Patel", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-NPN-0005", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: 12, assigneeName: "James van Wyk", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2025-06-21T09:00:00.000Z", decidedById: null, decidedByName: null }] ) },
];

async function main() {
  console.log("Seeding database...");

  const passwordHash = bcrypt.hashSync(DEFAULT_PASSWORD, SALT_ROUNDS);

  for (const o of organizations) {
    await prisma.organization.upsert({
      where: { id: o.id },
      update: o,
      create: o,
    });
  }
  console.log(`Seeded ${organizations.length} organizations`);

  // Users first, then department links (org-scoped master data; global
  // users stay unscoped).
  // Two passes: identity rows first with managerId unset, then the
  // authoritative manager links. A single pass violates the User_manager_fk
  // self-reference on a clean database (the manager row may not exist yet);
  // the old code only worked when re-seeding over existing rows.
  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: {
        name: u.name,
        email: u.email,
        role: u.role,
        teamMemberNumber: u.teamMemberNumber,
        department: u.department,
        position: u.position,
        lineManager: u.lineManager,
        managerId: null,
        organizationId: u.organizationId,
      },
      create: { ...u, managerId: null, passwordHash },
    });
  }
  for (const u of users) {
    if (u.managerId !== null && u.managerId !== undefined) {
      await prisma.user.update({ where: { id: u.id }, data: { managerId: u.managerId } });
    }
  }
  for (const u of users) {
    let departmentPk: bigint | null = null;
    if (u.organizationId !== null && u.department) {
      const dept = await prisma.department.upsert({
        where: { organizationId_name: { organizationId: u.organizationId, name: u.department } },
        create: { organizationId: u.organizationId, name: u.department },
        update: {},
      });
      departmentPk = dept.id;
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { departmentId: departmentPk },
    });
  }
  console.log(`Seeded ${users.length} users`);

  // Counterparties: one row per (organizationId, name) from declaration data.
  const cpKey = new Map<string, { name: string; organizationId: bigint | null; contactName: string | null }>();
  for (const d of declarations as any[]) {
    const orgPk: bigint | null = d.organizationId ?? null;
    const key = `${orgPk === null ? "" : String(orgPk)}||${String(d.counterparty).trim()}`;
    if (!cpKey.has(key)) {
      cpKey.set(key, { name: String(d.counterparty).trim(), organizationId: orgPk, contactName: d.contactPerson || null });
    }
  }
  const cpIdByKey = new Map<string, bigint>();
  for (const [key, cp] of cpKey) {
    let row: any = null;
    if (cp.organizationId !== null) {
      row = await prisma.counterparty.upsert({
        where: { name_organizationId: { name: cp.name, organizationId: cp.organizationId } },
        create: cp,
        update: {},
      }).catch(() => null);
    }
    if (!row) {
      // Global (null organizationId) rows skip the composite upsert — resolve by lookup.
      row = await prisma.counterparty.findFirst({ where: { name: cp.name, organizationId: null } });
      if (!row) row = await prisma.counterparty.create({ data: cp });
    }
    cpIdByKey.set(key, row.id);
  }
  console.log(`Seeded ${cpIdByKey.size} counterparties`);

  // Lean declarations + immutable snapshots + details.
  const toDate = (s: string) => new Date(`${s}T00:00:00.000Z`);
  for (const d of declarations as any[]) {
    const orgPk: bigint | null = d.organizationId ?? null;
    const key = `${orgPk === null ? "" : String(orgPk)}||${String(d.counterparty).trim()}`;
    const declarerPk: bigint | null = typeof d.employeeId === "bigint" ? d.employeeId : null;
    const approverPk: bigint | null = typeof d.approverId === "bigint" ? d.approverId : null;
    const decl = await prisma.declaration.upsert({
      where: { id: d.id },
      update: {
        type: d.type,
        value: d.value,
        status: d.status,
        priority: d.priority,
        organizationId: orgPk,
        eventDate: toDate(d.date),
        submittedAt: toDate(d.submitted),
        declarerUserId: declarerPk,
        currentApproverUserId: approverPk,
        counterpartyId: cpIdByKey.get(key) || null,
      },
      create: {
        id: d.id,
        type: d.type,
        value: d.value,
        status: d.status,
        priority: d.priority,
        organizationId: orgPk,
        eventDate: toDate(d.date),
        submittedAt: toDate(d.submitted),
        declarerUserId: declarerPk,
        currentApproverUserId: approverPk,
        counterpartyId: cpIdByKey.get(key) || null,
      },
    });
    const pk = decl.declarationPk;
    await prisma.declarationSnapshot.upsert({
      where: { declarationPk: pk },
      create: {
        declarationPk: pk,
        declarerName: d.employee,
        employeeNumber: d.teamMemberNumber,
        positionTitle: d.position,
        department: d.department,
        managerDisplayName: d.lineManager || null,
      },
      update: {},
    });
    await prisma.declarationDetail.upsert({
      where: { declarationPk: pk },
      create: {
        declarationPk: pk,
        description: d.description,
        occasion: d.occasion,
        relationship: d.relationship,
        receivedGiven: d.receivedGiven,
        fromField: d.fromField,
        contactPerson: d.contactPerson,
        biddingProcess: d.biddingProcess,
        contractNegotiation: (d as any).contractNegotiation ?? null,
        instances: d.instances,
        publicOfficial: d.publicOfficial,
        substantiation: (d as any).substantiation ?? null,
      },
      update: {
        description: d.description,
        occasion: d.occasion,
        relationship: d.relationship,
        receivedGiven: d.receivedGiven,
        fromField: d.fromField,
        contactPerson: d.contactPerson,
        biddingProcess: d.biddingProcess,
        contractNegotiation: (d as any).contractNegotiation ?? null,
        instances: d.instances,
        publicOfficial: d.publicOfficial,
        substantiation: (d as any).substantiation ?? null,
      },
    });
  }
  console.log(`Seeded ${declarations.length} declarations (+ snapshots/details)`);

  // Teams from declaration team strings (best-effort, under the snapshot department).
  for (const d of declarations as any[]) {
    if (!d.team || d.organizationId === null || d.organizationId === undefined) continue;
    const orgPk: bigint = d.organizationId;
    const dept = await prisma.department.findUnique({
      where: { organizationId_name: { organizationId: orgPk, name: d.department } },
    });
    if (!dept) continue;
    await prisma.team.upsert({
      where: { departmentId_name: { departmentId: dept.id, name: d.team } },
      create: { departmentId: dept.id, name: d.team },
      update: {},
    }).catch(() => undefined);
  }

  for (const r of workflowRules) {
    await prisma.workflowRule.upsert({
      where: { id: r.id },
      update: { name: r.name, condition: r.condition, priority: r.priority },
      create: r,
    });
  }
  for (const s of workflowRuleSteps) {
    await prisma.workflowRuleStep.upsert({
      where: { ruleId_order: { ruleId: s.ruleId, order: s.order } },
      create: s,
      update: { role: s.role, label: s.label },
    });
  }
  console.log(`Seeded ${workflowRules.length} workflow rules (+ ${workflowRuleSteps.length} rule steps)`);

  // Workflow instances: legacy step JSON in this file is parsed into step rows.
  // Step assignee keys are legacy user ids translated to numeric keys.
  const { writeWorkflowStepsTx } = await import("./services/normalization");
  const { determineRuleId } = await import("./services/workflowService");
  for (const w of workflowInstances) {
    const decl = (declarations as any[]).find((d) => d.id === w.declarationId);
    const steps = JSON.parse(w.steps).map((s: any) => ({
      order: s.order,
      role: s.role,
      assignee: typeof s.assignee === "number" ? s.assignee : null,
      assigneeName: s.assigneeName || "Unknown",
      label: s.label,
      status: s.status,
      decision: s.decision ?? null,
      approvedAt: null,
      notes: s.notes ?? "",
      decidedAt: s.decidedAt ?? null,
      decidedById: typeof s.decidedById === "number" ? s.decidedById : null,
      decidedByName: s.decidedByName ?? null,
    }));
    const ruleId = determineRuleId(decl?.value ?? 0, 1000, 1000);
    const target = await prisma.declaration.findUnique({ where: { id: w.declarationId }, select: { declarationPk: true } });
    if (!target) continue;
    await prisma.$transaction(async (tx: any) => {
      await writeWorkflowStepsTx(tx, target.declarationPk, steps, ruleId);
    });
  }
  console.log(`Seeded ${workflowInstances.length} workflow instances (+ step rows)`);

  // Explicit fixture ids must not collide with later autoincrement inserts.
  const { resetIdentitySequences } = await import("./services/normalization");
  await resetIdentitySequences(prisma);

  // System config
  const defaultNotificationTemplates = JSON.stringify({
    managerApproval: {
      subject: "GHE Declaration – Approval Required - [Declaration ID]",
      body: "Hi [Approving Manager Name],\n\nA new Gift, Hospitality and Entertainment (GHE) declaration has been submitted by [Team Member Name] and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review and action the declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
    },
    hrApproval: {
      subject: "GHE Declaration – HR Approval Required - [Declaration ID]",
      body: "Hi [HR Approver Name],\n\nA Gift, Hospitality and Entertainment (GHE) declaration has been submitted for HR approval and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review and action the declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
    },
    declarationReturned: {
      subject: "GHE Declaration – Action Required - [Declaration ID]",
      body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has been returned and requires your attention.\n\nPlease access the GHE Declaration App using the link below to review the feedback, make the required changes and resubmit your declaration.\n\n[Review Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
    },
    declarationDeclined: {
      subject: "GHE Declaration – Declined - [Declaration ID]",
      body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has been reviewed and declined.\n\nPlease access the GHE Declaration App using the link below to view the outcome and any relevant feedback.\n\n[View Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
    },
    declarationApproved: {
      subject: "GHE Declaration – Approved - [Declaration ID]",
      body: "Hi [Team Member Name],\n\nYour Gift, Hospitality and Entertainment (GHE) declaration has completed the required approval process and has been [Manager Approval Option].\n\nPlease access the GHE Declaration App using the link below to view your declaration.\n\n[View Declaration]\n\nKind regards,\nGHE Declaration System\n\nThis is an automated notification. Please do not reply to this email.",
    },
  });

  await prisma.systemConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      highValueThreshold: 1000,
      mediumValueThreshold: 1000,
      slaEscalationDays: 3,
      maxDeclarationsPerCounterparty: 5,
      maximumValue: 1000000,
      emailTemplate: "Hi {{ApproverName}},\n\nA new GHE Declaration ({{DeclarationID}}) from {{EmployeeName}} requires your review.\n\nPlease log into the system to approve or decline.\n\nRegards,\nCompliance Team",
      notificationTemplates: defaultNotificationTemplates,
    },
  });

  // Approval options
  const approvalOptions = [
    { id: "opt-1", value: "return", label: "Return - Team member to provide additional information." },
    { id: "opt-2", value: "accept", label: "Approved - Team Member to accept the actual GHE or offered GHE in their personal capacity." },
    { id: "opt-3", value: "org", label: "Approved - Team Member to share the actual GHE or offered GHE with the Organisation Pool." },
    { id: "opt-4", value: "foundation", label: "Approved - Team Member to donate the actual GHE or offered GHE to the Hollywood Foundation." },
    { id: "opt-5", value: "decline", label: "Declined - Team Member to return the actual GHE or regret the offered GHE." },
  ];
  for (const o of approvalOptions) {
    await prisma.approvalOption.upsert({
      where: { id: o.id },
      update: o,
      create: o,
    });
  }

  console.log("Seeded system config and approval options");
  console.log(`All passwords: "${DEFAULT_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
