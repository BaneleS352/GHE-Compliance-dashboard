import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SupportingDocumentsUpload } from "../app/components/SupportingDocumentsUpload";

describe("SupportingDocumentsUpload", () => {
  const baseProps = {
    files: [],
    dragging: false,
    onDraggingChange: vi.fn(),
    onFilesSelected: vi.fn(),
    onRemove: vi.fn(),
    onDownload: vi.fn(),
  };

  it("opens the file picker from keyboard activation", () => {
    render(<SupportingDocumentsUpload {...baseProps} />);
    const input = screen.getByLabelText("Choose supporting documents");
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyDown(input, { key: " " });

    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("exposes removal and download actions for uploaded files", () => {
    const file = { name: "receipt.pdf", size: 2048, type: "application/pdf", url: "/files/receipt.pdf", uploadId: "receipt-1" };
    render(<SupportingDocumentsUpload {...baseProps} files={[file]} />);

    fireEvent.click(screen.getByRole("button", { name: "Download receipt.pdf" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove receipt.pdf" }));

    expect(baseProps.onDownload).toHaveBeenCalledWith(file);
    expect(baseProps.onRemove).toHaveBeenCalledWith("receipt-1");
  });
});
