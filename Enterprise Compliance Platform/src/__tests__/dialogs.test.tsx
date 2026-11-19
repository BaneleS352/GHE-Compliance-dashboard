import { beforeEach, describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { fetchDepartments } from "../services/api";
import { ConfirmDialog } from "../app/components/ConfirmDialog";
import { PasswordDialog } from "../app/components/PasswordDialog";
import { UserDialog } from "../app/pages/admin/UserDialog";

vi.mock("../services/api", async () => {
  const actual = await vi.importActual<typeof import("../services/api")>("../services/api");
  return { ...actual, fetchDepartments: vi.fn() };
});

beforeEach(() => {
  vi.mocked(fetchDepartments).mockReset().mockResolvedValue(["Marketing", "Sales"]);
});

describe("ConfirmDialog", () => {
  it("renders title/message and confirms", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog title="Delete user" message="Sure?" confirmLabel="Delete" destructive onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole("dialog", { name: "Delete user" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("cancels on Escape", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog title="T" message="M" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("keeps keyboard focus inside the dialog and restores it on close", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<ConfirmDialog title="T" message="M" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    const buttons = screen.getAllByRole("button");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-dialog-title");
    expect(dialog).toHaveAttribute("aria-describedby", "confirm-dialog-message");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(buttons[buttons.length - 1]);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});

describe("UserDialog", () => {
  const orgs = [{ id: 1, name: "HB", shortCode: "HB" }];

  it("blocks invalid email without calling onSave", async () => {
    const onSave = vi.fn();
    render(<UserDialog user={null} organizations={orgs} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("traps focus, closes on Escape, and restores focus when closed", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const onCancel = vi.fn();
    const { unmount } = render(<UserDialog user={null} organizations={orgs} onSave={vi.fn()} onCancel={onCancel} />);
    const dialog = screen.getByRole("dialog", { name: "Add user" });
    expect(document.activeElement).toBe(dialog.querySelector("input"));
    const lastButton = screen.getByRole("button", { name: "Add user" });
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
    unmount();
    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });

  it("submits validated data with the selected organization", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserDialog user={null} organizations={orgs} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "test@hb.co.za" } });
    fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: "1" } });
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Add user" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test User", email: "test@hb.co.za", organizationId: 1 })
    ));
  });

  it("shows department lookup failures and prevents saving an incomplete organization profile", async () => {
    vi.mocked(fetchDepartments).mockRejectedValue(new Error("request failed"));
    render(<UserDialog user={null} organizations={orgs} onSave={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: "1" } });

    expect(await screen.findByRole("alert")).toHaveTextContent(/Departments could not be loaded/);
    expect(screen.getByRole("button", { name: "Add user" })).toBeDisabled();
  });

  it("ignores a department response after its organization request was cancelled", async () => {
    const mockedFetchDepartments = vi.mocked(fetchDepartments);
    let resolveFirst!: (departments: string[]) => void;
    let resolveSecond!: (departments: string[]) => void;
    const firstRequest = new Promise<string[]>((resolve) => { resolveFirst = resolve; });
    const secondRequest = new Promise<string[]>((resolve) => { resolveSecond = resolve; });
    mockedFetchDepartments.mockReturnValueOnce(firstRequest).mockReturnValueOnce(secondRequest);
    const organizations = [...orgs, { id: 2, name: "NPN", shortCode: "NPN" }];
    render(<UserDialog user={null} organizations={organizations} onSave={vi.fn()} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: "1" } });
    await vi.waitFor(() => expect(mockedFetchDepartments).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: "2" } });
    await vi.waitFor(() => expect(mockedFetchDepartments).toHaveBeenCalledTimes(2));
    expect(mockedFetchDepartments.mock.calls[0][1]?.signal?.aborted).toBe(true);

    await act(async () => { resolveSecond(["NPN Department"]); });
    expect(await screen.findByRole("option", { name: "NPN Department" })).toBeInTheDocument();
    await act(async () => { resolveFirst(["Stale Department"]); });
    expect(screen.queryByRole("option", { name: "Stale Department" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "NPN Department" })).toBeInTheDocument();
  });
});

describe("PasswordDialog", () => {
  const renderDialog = (onSubmit = vi.fn()) => {
    const onCancel = vi.fn();
    render(
      <PasswordDialog
        title="Protect Excel export"
        message="Set a password."
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
    return { onSubmit, onCancel };
  };

  const fillMatching = (password: string) => {
    const [pw, confirm] = screen.getAllByLabelText(/password/i);
    fireEvent.change(pw, { target: { value: password } });
    fireEvent.change(confirm, { target: { value: password } });
  };

  it("submits a valid matching password", () => {
    const { onSubmit } = renderDialog();
    fillMatching("s3cret-download-pw");
    fireEvent.click(screen.getByRole("button", { name: "Protect & Download" }));
    expect(onSubmit).toHaveBeenCalledWith("s3cret-download-pw");
  });

  it("blocks short passwords without submitting", () => {
    const { onSubmit } = renderDialog();
    fillMatching("short");
    fireEvent.click(screen.getByRole("button", { name: "Protect & Download" }));
    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks mismatched confirmation without submitting", () => {
    const { onSubmit } = renderDialog();
    const [pw, confirm] = screen.getAllByLabelText(/password/i);
    fireEvent.change(pw, { target: { value: "s3cret-download-pw" } });
    fireEvent.change(confirm, { target: { value: "something-else-entirely" } });
    fireEvent.click(screen.getByRole("button", { name: "Protect & Download" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/do not match/);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cancels via Cancel and Escape", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
