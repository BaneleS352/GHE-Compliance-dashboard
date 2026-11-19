import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { DeclarationDetailView } from "../app/components/DeclarationDetailView";
import { fetchDeclarationAudit, fetchPublicConfig } from "../services/api";
import type { Declaration } from "../types/declaration";

vi.mock("../services/api", () => ({
  fetchDeclarationAudit: vi.fn(),
  fetchPublicConfig: vi.fn(),
}));
vi.mock("../services/download", () => ({ downloadFile: vi.fn(), previewFile: vi.fn() }));
vi.mock("../app/components/notify", () => ({ notifyError: vi.fn() }));

const declaration: Declaration = {
  id: "GHE-2026-123456",
  employeeId: 1,
  value: 250,
  company: "Test Org",
  department: "Finance",
  lineManager: "Manager",
  employee: "Employee",
  teamMemberNumber: "TM-1",
  position: "Analyst",
  receivedGiven: "Received",
  type: "Gift",
  from: "Supplier",
  counterparty: "Vendor",
  contactPerson: "Contact",
  submitted: "2026-11-01",
  approver: "Manager",
  approverId: 2,
  status: "Pending",
  priority: "Low",
  relationship: "Supplier",
  date: "2026-11-01",
  occasion: "Meeting",
  instances: "1",
  publicOfficial: "No",
  biddingProcess: "No",
  contractNegotiation: "No",
  description: "Test",
  substantiation: "",
  files: [],
};

describe("Declaration change history", () => {
  it("shows the actor, action, fields, and recorded values", async () => {
    vi.mocked(fetchPublicConfig).mockResolvedValue({ highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maximumValue: 1000000 });
    vi.mocked(fetchDeclarationAudit).mockResolvedValue([{
      id: 1,
      action: "updated",
      changedFields: ["value"],
      oldValues: { value: 100 },
      newValues: { value: 250 },
      actorUserId: 4,
      actorName: "Nomvula",
      createdAt: "2026-11-05T10:00:00.000Z",
    }]);

    render(<DeclarationDetailView data={declaration} hideDocuments />);

    await waitFor(() => expect(screen.getByText("Declaration updated")).toBeInTheDocument());
    expect(fetchDeclarationAudit).toHaveBeenCalledWith(declaration.id);
    expect(screen.getByText("By Nomvula")).toBeInTheDocument();
    expect(screen.getByText("Changed: value")).toBeInTheDocument();
    expect(screen.getByText("View recorded values")).toBeInTheDocument();
  });

  it("shows a safe error state when history cannot be loaded", async () => {
    vi.mocked(fetchPublicConfig).mockResolvedValue({ highValueThreshold: 1000, mediumValueThreshold: 1000, slaEscalationDays: 3, maximumValue: 1000000 });
    vi.mocked(fetchDeclarationAudit).mockRejectedValue(new Error("forbidden"));

    render(<DeclarationDetailView data={declaration} hideDocuments />);

    expect(await screen.findByText(/Change history could not be loaded/)).toBeInTheDocument();
  });
});
