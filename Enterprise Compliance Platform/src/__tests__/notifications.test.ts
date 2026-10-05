import { describe, it, expect, vi } from "vitest";
import { toast } from "sonner";
import { notifySuccess, notifyError } from "../app/components/notify";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("shared notification interface", () => {
  it("routes success messages to toast.success", () => {
    notifySuccess("Draft saved.");
    expect(toast.success).toHaveBeenCalledWith("Draft saved.");
  });

  it("routes error messages to toast.error", () => {
    notifyError("Excel export failed. Please try again.");
    expect(toast.error).toHaveBeenCalledWith("Excel export failed. Please try again.");
  });
});
