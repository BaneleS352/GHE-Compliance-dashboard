import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SupportingDocumentsUpload } from "../app/components/SupportingDocumentsUpload";

describe("SupportingDocumentsUpload", () => {
  it.each(["Enter", " "]) ("opens the file picker on %s", (key) => {
    const { container } = render(
      <SupportingDocumentsUpload
        files={[]}
        dragging={false}
        onDraggingChange={vi.fn()}
        onFilesSelected={vi.fn()}
        onRemove={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(picker).not.toBeNull();
    expect(picker).toHaveAttribute("aria-hidden", "true");
    expect(picker).toHaveAttribute("tabindex", "-1");
    const click = vi.spyOn(picker!, "click").mockImplementation(() => {});

    fireEvent.keyDown(screen.getByRole("button", { name: "Choose supporting documents" }), { key });

    expect(click).toHaveBeenCalledTimes(1);
  });

  it("sends selected files to the form and clears the native input value", () => {
    const onFilesSelected = vi.fn();
    const { container } = render(
      <SupportingDocumentsUpload
        files={[]}
        dragging={false}
        onDraggingChange={vi.fn()}
        onFilesSelected={onFilesSelected}
        onRemove={vi.fn()}
        onDownload={vi.fn()}
      />,
    );
    const picker = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const file = new File(["evidence"], "receipt.pdf", { type: "application/pdf" });

    fireEvent.change(picker, { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith(picker.files);
    expect(picker.value).toBe("");
  });
});
