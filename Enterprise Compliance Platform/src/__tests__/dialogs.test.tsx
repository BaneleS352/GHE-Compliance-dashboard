import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../app/components/ConfirmDialog";
import { UserDialog } from "../app/pages/admin/UserDialog";

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

  it("submits validated data with the selected organization", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<UserDialog user={null} organizations={orgs} onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "Test User" } });
    fireEvent.change(screen.getByLabelText(/Email/), { target: { value: "test@hb.co.za" } });
    fireEvent.change(screen.getByLabelText(/Organization/), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Add user" }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test User", email: "test@hb.co.za", organizationId: 1 })
    ));
  });
});
