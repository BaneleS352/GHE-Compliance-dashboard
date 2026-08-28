import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DEFAULT_PASSWORD = "password";
const SALT_ROUNDS = 10;

const organizations = [
  { id: "org-1", name: "Hollywoodbets Group", shortCode: "HB" },
  { id: "org-2", name: "Naspers Limited", shortCode: "NPN" },
];

const users = [
  // Hollywoodbets Group (org-1)
  { id: "user-1", name: "Nomvula Dlamini", email: "nomvula@hb.co.za", role: "teamMember", teamMemberNumber: "HB-204478", department: "Marketing", position: "Senior Brand Manager", lineManager: "user-3", organizationId: "org-1" },
  { id: "user-2", name: "Thabo Mokoena", email: "thabo@hb.co.za", role: "teamMember", teamMemberNumber: "HB-187234", department: "Sales", position: "Sales Executive", lineManager: "user-4", organizationId: "org-1" },
  { id: "user-3", name: "Sipho Nkosi", email: "sipho@hb.co.za", role: "approver", teamMemberNumber: "HB-10001", department: "Marketing", position: "Line Manager", lineManager: null, organizationId: "org-1" },
  { id: "user-4", name: "Lindiwe Zulu", email: "lindiwe@hb.co.za", role: "approver", teamMemberNumber: "HB-10002", department: "HR", position: "Head of HR", lineManager: null, organizationId: "org-1" },
  { id: "user-6", name: "System Admin", email: "admin@hb.co.za", role: "admin", teamMemberNumber: "HB-00000", department: "IT", position: "System Administrator", lineManager: null, organizationId: "org-1" },
  { id: "user-7", name: "Pieter van der Berg", email: "pieter@hb.co.za", role: "teamMember", teamMemberNumber: "HB-156902", department: "Finance", position: "Finance Analyst", lineManager: "user-3", organizationId: "org-1" },
  { id: "user-8", name: "Ayanda Khumalo", email: "ayanda@hb.co.za", role: "teamMember", teamMemberNumber: "HB-219033", department: "Operations", position: "Operations Manager", lineManager: "user-3", organizationId: "org-1" },
  { id: "user-9", name: "Zanele Sithole", email: "zanele@hb.co.za", role: "teamMember", teamMemberNumber: "HB-198741", department: "HR", position: "HR Generalist", lineManager: "user-3", organizationId: "org-1" },
  { id: "user-10", name: "Bongani Cele", email: "bongani@hb.co.za", role: "teamMember", teamMemberNumber: "HB-234512", department: "IT", position: "IT Systems Lead", lineManager: "user-4", organizationId: "org-1" },
  { id: "user-11", name: "Fatima Ismail", email: "fatima@hb.co.za", role: "teamMember", teamMemberNumber: "HB-167823", department: "Legal", position: "Legal Counsel", lineManager: "user-3", organizationId: "org-1" },
  { id: "user-12", name: "Siphamandla Ndlovu", email: "siphamandla@hb.co.za", role: "teamMember", teamMemberNumber: "HB-244001", department: "Marketing", position: "Brand Strategist", lineManager: "user-4", organizationId: "org-1" },
  // Naspers Limited (org-2)
  { id: "user-20", name: "James van Wyk", email: "james@npn.co.za", role: "approver", teamMemberNumber: "NPN-10001", department: "Engineering", position: "Line Manager", lineManager: null, organizationId: "org-2" },
  { id: "user-21", name: "Aisha Patel", email: "aisha@npn.co.za", role: "approver", teamMemberNumber: "NPN-10002", department: "HR", position: "Head of HR", lineManager: null, organizationId: "org-2" },
  { id: "user-22", name: "Kabelo Molefe", email: "kabelo@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20001", department: "Engineering", position: "Software Engineer", lineManager: "user-20", organizationId: "org-2" },
  { id: "user-23", name: "Nomsa Dlamini", email: "nomsa@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20002", department: "Finance", position: "Financial Controller", lineManager: "user-20", organizationId: "org-2" },
  { id: "user-24", name: "Ravi Sharma", email: "ravi@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20003", department: "Marketing", position: "Marketing Manager", lineManager: "user-20", organizationId: "org-2" },
  { id: "user-25", name: "Lebo Mokoena", email: "lebo@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20004", department: "Legal", position: "Legal Advisor", lineManager: "user-21", organizationId: "org-2" },
  { id: "user-26", name: "Sipho Ndlovu", email: "sipho.n@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20005", department: "Operations", position: "Operations Lead", lineManager: "user-20", organizationId: "org-2" },
  { id: "user-27", name: "Fatima Jacobs", email: "fatima.j@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20006", department: "IT", position: "IT Manager", lineManager: "user-21", organizationId: "org-2" },
  { id: "user-28", name: "Thabo Zulu", email: "thabo.z@npn.co.za", role: "teamMember", teamMemberNumber: "NPN-20007", department: "Sales", position: "Sales Director", lineManager: "user-20", organizationId: "org-2" },
  { id: "user-29", name: "Admin NPN", email: "admin@npn.co.za", role: "admin", teamMemberNumber: "NPN-00000", department: "IT", position: "System Administrator", lineManager: null, organizationId: "org-2" },
];

const declarations = [
  // Hollywoodbets Group declarations
  { id: "GHE-2024-0047", employee: "Nomvula Dlamini", employeeId: "user-1", teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Tsogo Sun Hotels", value: 8500, submitted: "2024-11-12", approver: "Sipho Nkosi", approverId: "user-3", status: "Pending", priority: "High", description: "Corporate dinner for key partners at Sandton Sun", relationship: "Client \u2013 Strategic Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John Smith", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-10", instances: "2", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0046", employee: "Thabo Mokoena", employeeId: "user-2", teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Gift", counterparty: "Makro", value: 1200, submitted: "2024-11-10", approver: "Lindiwe Zulu", approverId: "user-4", status: "Approved", priority: "Low", description: "End-of-year gift basket received from supplier", relationship: "Supplier \u2013 Regular", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Jane Dube", biddingProcess: "No", occasion: "Festive", date: "2024-11-08", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0045", employee: "Ayanda Khumalo", employeeId: "user-8", teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Entertainment", counterparty: "Emirates Airline", value: 34000, submitted: "2024-11-08", approver: "Sipho Nkosi", approverId: "user-3", status: "Pending", priority: "High", description: "Business class flights and lounge access for conference", relationship: "Counterparty \u2013 Technology", receivedGiven: "Received", fromField: "Customer", contactPerson: "Ahmed Al-Rashid", biddingProcess: "Yes", occasion: "Other", date: "2024-11-05", instances: "3", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0044", employee: "Pieter van der Berg", employeeId: "user-7", teamMemberNumber: "HB-156902", lineManager: "Sipho Nkosi", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", counterparty: "La Colombe Restaurant", value: 3200, submitted: "2024-11-06", approver: "Sipho Nkosi", approverId: "user-3", status: "Pending", priority: "Medium", description: "Lunch meeting with audit consultants", relationship: "Service Provider \u2013 Annual", receivedGiven: "Given", fromField: "Customer", contactPerson: "Mark Johnson", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2024-11-04", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0043", employee: "Zanele Sithole", employeeId: "user-9", teamMemberNumber: "HB-198741", lineManager: "Sipho Nkosi", position: "HR Generalist", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", counterparty: "Woolworths", value: 650, submitted: "2024-11-04", approver: "Lindiwe Zulu", approverId: "user-4", status: "Approved", priority: "Low", description: "Festive season hamper from staffing agency", relationship: "Supplier \u2013 Staffing", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Thandi Molefe", biddingProcess: "No", occasion: "Festive", date: "2024-11-02", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0042", employee: "Bongani Cele", employeeId: "user-10", teamMemberNumber: "HB-234512", lineManager: "Lindiwe Zulu", position: "IT Systems Lead", department: "IT", company: "Hollywoodbets Group", team: "Technology", type: "Entertainment", counterparty: "Sun International", value: 12800, submitted: "2024-11-02", approver: "Lindiwe Zulu", approverId: "user-4", status: "Pending", priority: "Medium", description: "Golf day and networking event hosted by Sun International", relationship: "Counterparty \u2013 IT Solutions", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Riaan Botha", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2024-10-31", instances: "2", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0041", employee: "Fatima Ismail", employeeId: "user-11", teamMemberNumber: "HB-167823", lineManager: "Sipho Nkosi", position: "Legal Counsel", department: "Legal", company: "Hollywoodbets Group", team: "Legal & Compliance", type: "Gift", counterparty: "Edgars", value: 890, submitted: "2024-10-30", approver: "Lindiwe Zulu", approverId: "user-4", status: "Returned", priority: "Medium", description: "Clothing voucher received at legal conference", relationship: "External \u2013 Industry Event", receivedGiven: "Received", fromField: "Customer", contactPerson: "Priya Naidoo", biddingProcess: "N/A", occasion: "Other", date: "2024-10-28", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2024-0040", employee: "Siphamandla Ndlovu", employeeId: "user-12", teamMemberNumber: "HB-244001", lineManager: "Lindiwe Zulu", position: "Brand Strategist", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Radisson Blu", value: 5600, submitted: "2024-10-28", approver: "Lindiwe Zulu", approverId: "user-4", status: "Draft", priority: "Low", description: "Team dinner for campaign launch celebration", relationship: "Internal \u2013 Team Event", receivedGiven: "Given", fromField: "Team Member", contactPerson: "Lebo Mahlangu", biddingProcess: "No", occasion: "Milestone", date: "2024-10-25", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0011", employee: "Nomvula Dlamini", employeeId: "user-1", teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Gift", counterparty: "Nike SA", value: 1500, submitted: "2025-06-15", approver: "Lindiwe Zulu", approverId: "user-4", status: "Pending", priority: "Low", description: "Promotional merchandise received at a brand activation event", relationship: "Supplier \u2013 Marketing", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Mike Brown", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-14", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0010", employee: "Thabo Mokoena", employeeId: "user-2", teamMemberNumber: "HB-187234", lineManager: "Lindiwe Zulu", position: "Sales Executive", department: "Sales", company: "Hollywoodbets Group", team: "Enterprise Sales", type: "Entertainment", counterparty: "Vodacom SA", value: 4500, submitted: "2025-06-12", approver: "Lindiwe Zulu", approverId: "user-4", status: "Pending", priority: "Medium", description: "Client dinner and tickets to Springbok match at Loftus Versfeld", relationship: "Client \u2013 Key Account", receivedGiven: "Received", fromField: "Customer", contactPerson: "Thabo Mokoena", biddingProcess: "No", occasion: "Relationship Maintenance", date: "2025-06-10", instances: "2", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0009", employee: "Nomvula Dlamini", employeeId: "user-1", teamMemberNumber: "HB-204478", lineManager: "Sipho Nkosi", position: "Senior Brand Manager", department: "Marketing", company: "Hollywoodbets Group", team: "Brand & Communications", type: "Hospitality", counterparty: "Southern Sun", value: 2200, submitted: "2025-06-08", approver: "Lindiwe Zulu", approverId: "user-4", status: "Approved", priority: "Low", description: "Overnight accommodation for conference attendance", relationship: "Supplier \u2013 Hospitality", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Nomsa Khumalo", biddingProcess: "No", occasion: "Milestone", date: "2025-06-07", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0008", employee: "Ayanda Khumalo", employeeId: "user-8", teamMemberNumber: "HB-219033", lineManager: "Sipho Nkosi", position: "Operations Manager", department: "Operations", company: "Hollywoodbets Group", team: "Operations", type: "Gift", counterparty: "Deloitte SA", value: 800, submitted: "2025-06-05", approver: "Lindiwe Zulu", approverId: "user-4", status: "Pending", priority: "Low", description: "Corporate gift basket sent to audit team as appreciation", relationship: "Service Provider \u2013 Annual Audit", receivedGiven: "Given", fromField: "Customer", contactPerson: "Sarah van Wyk", biddingProcess: "No", occasion: "Festive Season", date: "2025-06-03", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0007", employee: "Pieter van der Berg", employeeId: "user-7", teamMemberNumber: "HB-156902", lineManager: "Sipho Nkosi", position: "Finance Analyst", department: "Finance", company: "Hollywoodbets Group", team: "Financial Reporting", type: "Hospitality", counterparty: "Standard Bank", value: 3800, submitted: "2025-06-01", approver: "Sipho Nkosi", approverId: "user-3", status: "Pending", priority: "Medium", description: "Working lunch with banking partners to discuss credit facilities", relationship: "Banking Partner", receivedGiven: "Given", fromField: "Customer", contactPerson: "Peter Mkhize", biddingProcess: "Yes", occasion: "Business Meeting", date: "2025-05-30", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0020", employee: "Lindiwe Zulu", employeeId: "user-4", teamMemberNumber: "HB-10002", lineManager: "Sipho Nkosi", position: "Head of HR", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Hospitality", counterparty: "The Campus Honeydew", value: 1800, submitted: "2025-06-18", approver: "Sipho Nkosi", approverId: "user-3", status: "Pending", priority: "Low", description: "HR leadership offsite venue booking", relationship: "Venue Provider", receivedGiven: "Given", fromField: "Supplier", contactPerson: "Naledi Mokoena", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-17", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  { id: "GHE-2025-0021", employee: "Lindiwe Zulu", employeeId: "user-4", teamMemberNumber: "HB-10002", lineManager: "Sipho Nkosi", position: "Head of HR", department: "HR", company: "Hollywoodbets Group", team: "People & Culture", type: "Gift", counterparty: "Clicks", value: 320, submitted: "2025-06-20", approver: "Sipho Nkosi", approverId: "user-3", status: "Approved", priority: "Low", description: "Wellness gift for long-serving employee", relationship: "Retailer", receivedGiven: "Given", fromField: "Supplier", contactPerson: "Kgomotso Mokoena", biddingProcess: "No", occasion: "Milestone", date: "2025-06-19", instances: "1", publicOfficial: "No", organizationId: "org-1" },
  // Naspers Limited declarations
  { id: "GHE-NPN-0001", employee: "Kabelo Molefe", employeeId: "user-22", teamMemberNumber: "NPN-20001", lineManager: "James van Wyk", position: "Software Engineer", department: "Engineering", company: "Naspers Limited", team: "Platform Engineering", type: "Gift", counterparty: "Microsoft SA", value: 750, submitted: "2025-06-10", approver: "James van Wyk", approverId: "user-20", status: "Pending", priority: "Low", description: "Developer conference swag bag", relationship: "Technology Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Liam O'Brien", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-09", instances: "1", publicOfficial: "No", organizationId: "org-2" },
  { id: "GHE-NPN-0002", employee: "Nomsa Dlamini", employeeId: "user-23", teamMemberNumber: "NPN-20002", lineManager: "James van Wyk", position: "Financial Controller", department: "Finance", company: "Naspers Limited", team: "Group Finance", type: "Hospitality", counterparty: "KPMG", value: 4200, submitted: "2025-06-12", approver: "James van Wyk", approverId: "user-20", status: "Pending", priority: "Medium", description: "Audit closing dinner at The Saxon Hotel", relationship: "Audit Partner", receivedGiven: "Received", fromField: "Supplier", contactPerson: "David Nkosi", biddingProcess: "Yes", occasion: "Milestone", date: "2025-06-11", instances: "1", publicOfficial: "No", organizationId: "org-2" },
  { id: "GHE-NPN-0003", employee: "Ravi Sharma", employeeId: "user-24", teamMemberNumber: "NPN-20003", lineManager: "James van Wyk", position: "Marketing Manager", department: "Marketing", company: "Naspers Limited", team: "Group Marketing", type: "Entertainment", counterparty: "SuperSport", value: 12500, submitted: "2025-06-15", approver: "Aisha Patel", approverId: "user-21", status: "Pending", priority: "High", description: "VIP box at Champions League final screening", relationship: "Media Partner", receivedGiven: "Received", fromField: "Customer", contactPerson: "Mark Richards", biddingProcess: "Yes", occasion: "Relationship Maintenance", date: "2025-06-14", instances: "2", publicOfficial: "No", organizationId: "org-2" },
  { id: "GHE-NPN-0004", employee: "Lebo Mokoena", employeeId: "user-25", teamMemberNumber: "NPN-20004", lineManager: "Aisha Patel", position: "Legal Advisor", department: "Legal", company: "Naspers Limited", team: "Group Legal", type: "Gift", counterparty: "Webber Wentzel", value: 2200, submitted: "2025-06-18", approver: "James van Wyk", approverId: "user-20", status: "Draft", priority: "Low", description: "Law firm anniversary gift received at legal summit", relationship: "External \u2013 Industry Event", receivedGiven: "Received", fromField: "Customer", contactPerson: "Adv. Mthethwa", biddingProcess: "No", occasion: "Other", date: "2025-06-17", instances: "1", publicOfficial: "No", organizationId: "org-2" },
  { id: "GHE-NPN-0005", employee: "Sipho Ndlovu", employeeId: "user-26", teamMemberNumber: "NPN-20005", lineManager: "James van Wyk", position: "Operations Lead", department: "Operations", company: "Naspers Limited", team: "Group Operations", type: "Hospitality", counterparty: "Gautrain", value: 650, submitted: "2025-06-20", approver: "James van Wyk", approverId: "user-20", status: "Approved", priority: "Low", description: "Executive transport service for board meeting", relationship: "Service Provider", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Busisiwe Mkhize", biddingProcess: "No", occasion: "Business Meeting", date: "2025-06-19", instances: "1", publicOfficial: "No", organizationId: "org-2" },
];

const workflowRules = [
  { id: "rule-1", name: "Low Value (R0\u2013R1000)", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
  { id: "rule-2", name: "High Value (above R1000)", condition: "high", priority: 2, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }]) },
];

const workflowInstances: { declarationId: string; steps: string }[] = [
  { declarationId: "GHE-2024-0047", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0045", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0044", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0042", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0011", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0010", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0008", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0007", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0009", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved. Reasonable expense for conference attendance.", decidedAt: "2025-06-09T10:30:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2025-06-10T14:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0020", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2025-0021", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved by line manager.", decidedAt: "2025-06-20T09:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2025-06-20T11:30:00.000Z", decidedById: null, decidedByName: null }]) },
  // Missing Approved/Returned instances (H6)
  { declarationId: "GHE-2024-0046", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2024-11-11T10:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "approved", decision: "org", notes: "Approved for organisation pool.", decidedAt: "2024-11-11T14:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0043", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2024-11-05T09:00:00.000Z", decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-2024-0041", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-3", assigneeName: "Sipho Nkosi", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved by LM.", decidedAt: "2024-10-29T10:00:00.000Z", decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-4", assigneeName: "Lindiwe Zulu", label: "HR Review", status: "returned", decision: "return", notes: "Need more detail", decidedAt: "2024-10-30T10:00:00.000Z", decidedById: null, decidedByName: null }]) },
  // Naspers Limited workflow instances
  { declarationId: "GHE-NPN-0001", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-20", assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }] ) },
  { declarationId: "GHE-NPN-0002", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-20", assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-21", assigneeName: "Aisha Patel", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-NPN-0003", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-20", assigneeName: "James van Wyk", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }, { order: 2, role: "hr", assignee: "user-21", assigneeName: "Aisha Patel", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null, decidedById: null, decidedByName: null }]) },
  { declarationId: "GHE-NPN-0005", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-20", assigneeName: "James van Wyk", label: "Line Manager Review", status: "approved", decision: "accept", notes: "Approved.", decidedAt: "2025-06-21T09:00:00.000Z", decidedById: null, decidedByName: null }] ) },
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

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      update: u,
      create: { ...u, passwordHash },
    });
  }
  console.log(`Seeded ${users.length} users`);

  for (const d of declarations) {
    await prisma.declaration.upsert({
      where: { id: d.id },
      update: d,
      create: d,
    });
  }
  console.log(`Seeded ${declarations.length} declarations`);

  for (const r of workflowRules) {
    await prisma.workflowRule.upsert({
      where: { id: r.id },
      update: r,
      create: r,
    });
  }
  console.log(`Seeded ${workflowRules.length} workflow rules`);

  for (const w of workflowInstances) {
    await prisma.workflowInstance.upsert({
      where: { declarationId: w.declarationId },
      update: w,
      create: w,
    });
  }
  console.log(`Seeded ${workflowInstances.length} workflow instances`);

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
      emailTemplate: "Hi {{ApproverName}},\n\nA new GHE Declaration ({{DeclarationID}}) from {{EmployeeName}} requires your review.\n\nPlease log into the system to approve or decline.\n\nRegards,\nCompliance Team",
      notificationTemplates: defaultNotificationTemplates,
    },
  });

  // Dropdowns
  await prisma.dropdowns.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      data: JSON.stringify({
        departments: ["Marketing", "Sales", "Operations", "Finance", "HR", "IT", "Legal", "Executive"],
        categories: ["Gift", "Hospitality", "Entertainment"],
        occasions: ["Business Meeting", "Festive Season", "Milestone", "Other", "Relationship Maintenance", "Year End"],
        receivedGiven: ["Received", "Given"],
        biddingProcess: ["Yes", "No", "N/A"],
        publicOfficial: ["Yes", "No"],
        relationships: ["Yes", "No", "N/A"],
        partyTypes: ["Supplier", "Customer", "Team Member", "Public Official"],
      }),
    },
  });

  // Compliance trend
  const trendData = [
    { id: "trend-1", month: "Jun", approved: 14, declined: 4 },
    { id: "trend-2", month: "Jul", approved: 19, declined: 5 },
    { id: "trend-3", month: "Aug", approved: 15, declined: 4 },
    { id: "trend-4", month: "Sep", approved: 25, declined: 6 },
    { id: "trend-5", month: "Oct", approved: 22, declined: 6 },
    { id: "trend-6", month: "Nov", approved: 18, declined: 4 },
  ];
  for (const t of trendData) {
    await prisma.complianceTrendPoint.upsert({
      where: { id: t.id },
      update: t,
      create: t,
    });
  }

  // Type breakdown
  const breakdownData = [
    { id: "type-1", name: "Gift", value: 38, color: "#7c3aed" },
    { id: "type-2", name: "Hospitality", value: 41, color: "#0891b2" },
    { id: "type-3", name: "Entertainment", value: 21, color: "#d97706" },
  ];
  for (const b of breakdownData) {
    await prisma.typeBreakdownItem.upsert({
      where: { id: b.id },
      update: b,
      create: b,
    });
  }

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

  console.log("Seeded system config, dropdowns, trend data, type breakdown, and approval options");
  console.log(`All passwords: "${DEFAULT_PASSWORD}"`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
