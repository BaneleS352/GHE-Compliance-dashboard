import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { execSync } from "child_process";

const TEST_DB_URL = "file:./test.db";

export async function setup() {
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_SECRET = "test-secret";

  execSync("npx prisma db push --force-reset --skip-generate", {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB_URL },
    stdio: "pipe",
  });

  const prisma = new PrismaClient();
  const hash = bcrypt.hashSync("password", 10);

  await prisma.user.createMany({
    data: [
      { id: "user-admin", name: "Admin User", email: "admin@test.com", passwordHash: hash, role: "admin", teamMemberNumber: "ADM-001", department: "IT", position: "System Admin", lineManager: null },
      { id: "user-approver", name: "Sipho Approver", email: "sipho@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-001", department: "Marketing", position: "Line Manager", lineManager: "user-ceo" },
      { id: "user-hr", name: "Lindiwe HR", email: "lindiwe@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-002", department: "HR", position: "Head of HR", lineManager: "user-ceo" },
      { id: "user-ceo", name: "Sandile CEO", email: "sandile@test.com", passwordHash: hash, role: "approver", teamMemberNumber: "APR-003", department: "Executive", position: "Group CEO", lineManager: "user-ceo" },
      { id: "user-team", name: "Nomvula Team", email: "nomvula@test.com", passwordHash: hash, role: "teamMember", teamMemberNumber: "TM-001", department: "Marketing", position: "Brand Manager", lineManager: "user-approver" },
    ],
  });

  await prisma.systemConfig.create({
    data: { id: "default", highValueThreshold: 2000, mediumValueThreshold: 250, slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "Test {{ApproverName}}" },
  });

  await prisma.workflowRule.createMany({
    data: [
      { id: "rule-1", name: "Low Value", condition: "low", priority: 1, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }]) },
      { id: "rule-2", name: "Medium Value", condition: "medium", priority: 2, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }]) },
      { id: "rule-3", name: "High Value", condition: "high", priority: 3, steps: JSON.stringify([{ order: 1, role: "lineManager", label: "Line Manager Review" }, { order: 2, role: "hr", label: "HR Review" }, { order: 3, role: "ceo", label: "CEO Approval" }]) },
    ],
  });

  await prisma.declaration.createMany({
    data: [
      { id: "GHE-TEST-001", employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing", company: "Test Corp", team: "Brand", type: "Gift", counterparty: "Supplier A", value: 100, submitted: "2026-01-15", approver: "Sipho Approver", status: "Pending", priority: "Low", description: "Test declaration", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "John", biddingProcess: "No", occasion: "Business Meeting", date: "2026-01-14", instances: "1", publicOfficial: "No" },
      { id: "GHE-TEST-002", employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing", company: "Test Corp", team: "Brand", type: "Gift", counterparty: "Supplier B", value: 500, submitted: "2026-02-01", approver: "Lindiwe HR", status: "Pending", priority: "Medium", description: "Second test", relationship: "Test", receivedGiven: "Given", fromField: "Customer", contactPerson: "Jane", biddingProcess: "No", occasion: "Milestone", date: "2026-01-30", instances: "1", publicOfficial: "No" },
      { id: "GHE-TEST-003", employee: "Nomvula Team", employeeId: "user-team", teamMemberNumber: "TM-001", lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing", company: "Test Corp", team: "Brand", type: "Hospitality", counterparty: "Supplier C", value: 3000, submitted: "2026-03-01", approver: "Sandile CEO", status: "Approved", priority: "High", description: "High value", relationship: "Test", receivedGiven: "Received", fromField: "Supplier", contactPerson: "Bob", biddingProcess: "Yes", occasion: "Other", date: "2026-02-28", instances: "2", publicOfficial: "No" },
    ],
  });

  await prisma.workflowInstance.createMany({
    data: [
      { declarationId: "GHE-TEST-001", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null }]) },
      { declarationId: "GHE-TEST-002", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "pending", decision: null, notes: "", decidedAt: null }, { order: 2, role: "hr", assignee: "user-hr", assigneeName: "Lindiwe HR", label: "HR Review", status: "pending", decision: null, notes: "", decidedAt: null }]) },
      { declarationId: "GHE-TEST-003", steps: JSON.stringify([{ order: 1, role: "lineManager", assignee: "user-approver", assigneeName: "Sipho Approver", label: "Line Manager Review", status: "approved", decision: "accept", notes: "OK", decidedAt: "2026-03-02T10:00:00.000Z" }, { order: 2, role: "hr", assignee: "user-hr", assigneeName: "Lindiwe HR", label: "HR Review", status: "approved", decision: "org", notes: "Approved", decidedAt: "2026-03-03T10:00:00.000Z" }, { order: 3, role: "ceo", assignee: "user-ceo", assigneeName: "Sandile CEO", label: "CEO Approval", status: "approved", decision: "accept", notes: "Done", decidedAt: "2026-03-04T10:00:00.000Z" }]) },
    ],
  });

  await prisma.complianceTrendPoint.createMany({
    data: [
      { id: "ct-1", month: "Jan", approved: 5, declined: 1 },
      { id: "ct-2", month: "Feb", approved: 8, declined: 2 },
    ],
  });

  await prisma.typeBreakdownItem.createMany({
    data: [
      { id: "tb-1", name: "Gift", value: 50, color: "#7c3aed" },
      { id: "tb-2", name: "Hospitality", value: 30, color: "#0891b2" },
    ],
  });

  await prisma.approvalOption.createMany({
    data: [
      { id: "ao-1", value: "accept", label: "Accept personally" },
      { id: "ao-2", value: "org", label: "Org pool" },
      { id: "ao-3", value: "foundation", label: "Donate to foundation" },
      { id: "ao-4", value: "decline", label: "Decline" },
      { id: "ao-5", value: "return", label: "Return for info" },
      { id: "ao-6", value: "reject", label: "Reject" },
      { id: "ao-7", value: "info", label: "Request info" },
      { id: "ao-8", value: "escalate", label: "Escalate" },
    ],
  });

  await prisma.dropdowns.create({
    data: { id: "default", data: JSON.stringify({ departments: ["Marketing", "IT", "HR"], categories: ["Gift", "Hospitality"], occasions: ["Business Meeting", "Milestone"], receivedGiven: ["Received", "Given"], biddingProcess: ["Yes", "No"], publicOfficial: ["Yes", "No"], relationships: ["Yes", "No"], partyTypes: ["Supplier", "Customer"] }) },
  });

  await prisma.$disconnect();
}

export async function teardown() {
  const prisma = new PrismaClient();
  // Can't easily delete all tables, so just disconnect
  await prisma.$disconnect();
}
