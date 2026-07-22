import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NewDeclarationScreen } from "../app/pages/NewDeclarationScreen";
import { createDeclaration, submitDeclaration, updateDeclaration, fetchConfig, fetchUserById } from "../services/api";

const mockConfig = {
  highValueThreshold: 2000, mediumValueThreshold: 250,
  slaEscalationDays: 3, maxDeclarationsPerCounterparty: 5, emailTemplate: "",
};

vi.mock("../services/api", () => ({
  fetchConfig: vi.fn(() => Promise.resolve(mockConfig)),
  fetchUserById: vi.fn(() => Promise.resolve({ id: "user-3", name: "Sipho Nkosi" })),
  createDeclaration: vi.fn(),
  submitDeclaration: vi.fn(),
  updateDeclaration: vi.fn(),
}));

vi.mock("../app/auth/UserContext", () => ({
  useUser: () => ({
    user: { id: "user-1", name: "Test User", email: "test@hb.co.za", role: "teamMember" as const,
            teamMemberNumber: "HB-10001", department: "Marketing", position: "Brand Manager",
            lineManager: "user-3" },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  class RO {
    cb: any;
    constructor(cb: any) { this.cb = cb; }
    observe() { this.cb([{ contentRect: { width: 400, height: 600 } }]); }
    unobserve() {}
    disconnect() {}
  }
  (globalThis as any).ResizeObserver = RO;
  Element.prototype.scrollIntoView = vi.fn();
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, value: 400 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, value: 600 });
});

function fillForm() {
  fireEvent.change(screen.getByPlaceholderText("e.g. HB-204478"), { target: { value: "HB-10001" } });
  fireEvent.change(screen.getByPlaceholderText("Full legal name"), { target: { value: "Acme Corp" } });
  fireEvent.change(screen.getByPlaceholderText("e.g. Ahmed Al-Rashid"), { target: { value: "John Doe" } });

  const triggers = screen.getAllByRole("combobox");
  const selectValues = ["Received", "Supplier", "No", "No", "Yes", "Gift", "Business Meeting", "1"];
  for (let i = 0; i < triggers.length; i++) {
    fireEvent.click(triggers[i]);
    fireEvent.click(screen.getByRole("option", { name: selectValues[i] }));
  }

  fireEvent.change(screen.getByPlaceholderText(/Corporate dinner at Sandton Sun/i), { target: { value: "Test gift description" } });
  fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "500" } });
  const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
  if (dateInput) fireEvent.change(dateInput, { target: { value: "2026-07-15" } });
}

describe("NewDeclarationScreen", () => {
  it("renders the form with sections", async () => {
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText(/New Declaration/i)).toBeInTheDocument();
    });
    const sections = screen.getAllByText(/Team Member Details/i);
    expect(sections.length).toBeGreaterThanOrEqual(1);
    const declDetails = screen.getAllByText(/Declaration Details/i);
    expect(declDetails.length).toBeGreaterThanOrEqual(1);
    const gheDetails = screen.getAllByText(/Gift, Hospitality or Entertainment Details/i);
    expect(gheDetails.length).toBeGreaterThanOrEqual(1);
    const suppDocs = screen.getAllByText(/Supporting Documents/i);
    expect(suppDocs.length).toBeGreaterThanOrEqual(1);
    const declUndertaking = screen.getAllByText(/Declaration & Undertaking/i);
    expect(declUndertaking.length).toBeGreaterThanOrEqual(1);
  });

  it("auto-fills team member name from user context", async () => {
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue("Test User");
      expect(nameInput).toBeInTheDocument();
    });
  });

  it("shows validation errors when submitting empty form", async () => {
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());

    const submitBtn = screen.getByRole("button", { name: /Submit Declaration/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Required/).length).toBeGreaterThan(0);
    });
  });

  it("calls createDeclaration + submitDeclaration on valid submit", async () => {
    vi.mocked(createDeclaration).mockResolvedValue({ id: "GHE-2026-9999", status: "Draft" } as any);
    vi.mocked(submitDeclaration).mockResolvedValue({ id: "GHE-2026-9999", status: "Pending", approver: "Sipho Nkosi" } as any);

    const onSuccess = vi.fn();
    render(<NewDeclarationScreen onSubmitSuccess={onSuccess} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue("Test User")).toBeInTheDocument());

    fillForm();
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /Submit Declaration/i });
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(createDeclaration).toHaveBeenCalled();
      expect(submitDeclaration).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it("calls createDeclaration on Save Draft", async () => {
    vi.mocked(createDeclaration).mockResolvedValue({ id: "GHE-2026-9999", status: "Draft" } as any);

    const onDraftSaved = vi.fn();
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={onDraftSaved} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue("Test User")).toBeInTheDocument());

    const saveDraftBtn = screen.getByRole("button", { name: /Save Draft/i });
    fireEvent.click(saveDraftBtn);

    await waitFor(() => {
      expect(createDeclaration).toHaveBeenCalled();
      expect(onDraftSaved).toHaveBeenCalled();
    });
  });

  it("shows substantiation field when value exceeds high threshold", async () => {
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());

    const valueInput = screen.getByPlaceholderText("0.00");
    fireEvent.focus(valueInput);
    fireEvent.change(valueInput, { target: { value: "5000" } });

    await waitFor(() => {
      expect(screen.getByText(/substantiate why this Gift/i)).toBeInTheDocument();
    });
  });

  it("keeps the shared select trigger height aligned with the date input", async () => {
    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const selectTrigger = screen.getAllByRole("combobox")[0];

    expect(dateInput.className).toContain("h-11");
    expect(selectTrigger.className).toContain("data-[size=default]:h-11");
  });

  it("shows upload error for unsupported file type", async () => {
    const { container } = render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());

    const fileInput = container.querySelector('input[type="file"]')!;
    const file = new File(["dummy"], "test.html", { type: "text/html" });
    Object.defineProperty(fileInput, "files", { value: [file] });
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(screen.getByText(/Unsupported file type/i)).toBeInTheDocument();
    });
  });

  it("shows submit error when API fails", async () => {
    vi.mocked(createDeclaration).mockRejectedValue(new Error("Server error"));

    render(<NewDeclarationScreen onSubmitSuccess={vi.fn()} onDraftSaved={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/New Declaration/i)).toBeInTheDocument());
    await waitFor(() => expect(screen.getByDisplayValue("Test User")).toBeInTheDocument());

    fillForm();
    await waitFor(() => {
      const submitBtn = screen.getByRole("button", { name: /Submit Declaration/i });
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/Server error/i)).toBeInTheDocument();
    });
  });
});
