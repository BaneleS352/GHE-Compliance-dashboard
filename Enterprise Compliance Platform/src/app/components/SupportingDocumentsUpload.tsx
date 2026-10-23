import { useRef } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { PURPLE } from "@/config/theme";
import type { UploadedFile } from "@/types/declaration";

export type UploadFile = UploadedFile & { uploadId?: string };

interface SupportingDocumentsUploadProps {
  files: UploadFile[];
  dragging: boolean;
  onDraggingChange: (dragging: boolean) => void;
  onFilesSelected: (files: FileList | null) => void;
  onRemove: (fileId: string) => void;
  onDownload: (file: UploadFile) => void;
}

export function SupportingDocumentsUpload({
  files,
  dragging,
  onDraggingChange,
  onFilesSelected,
  onRemove,
  onDownload,
}: SupportingDocumentsUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
        className="sr-only"
        onChange={(event) => { onFilesSelected(event.target.files); event.target.value = ""; }}
      />
      <div
        role="button"
        tabIndex={0}
        aria-label="Choose supporting documents"
        onDragOver={(event) => { event.preventDefault(); onDraggingChange(true); }}
        onDragLeave={() => onDraggingChange(false)}
        onDrop={(event) => { event.preventDefault(); onDraggingChange(false); onFilesSelected(event.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`rounded-2xl border-2 border-dashed py-12 px-6 text-center cursor-pointer transition-all duration-300 ease-out group ${
          dragging
            ? "border-purple-500 bg-purple-50/50 scale-[1.02] shadow-sm"
            : "border-slate-300 bg-slate-50 hover:border-purple-400 hover:bg-purple-50/30 hover:shadow-sm"
        }`}
      >
        <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center mx-auto mb-4 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
          <Upload size={24} style={{ color: PURPLE }} />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1.5">Drag & drop files here, or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF (preferred), PNG, JPG, DOCX — max 20 MB each</p>
      </div>
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file) => {
            const fileId = file.uploadId || `${file.name}-${file.size}`;
            return (
              <div key={fileId} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Paperclip size={13} style={{ color: PURPLE }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
                <button type="button" title={`Download ${file.name}`} onClick={(event) => { event.stopPropagation(); onDownload(file); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-primary">
                  <Download size={13} />
                </button>
                <button type="button" aria-label={`Remove ${file.name}`} onClick={(event) => { event.stopPropagation(); onRemove(fileId); }} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-3">Upload invoices, receipts, photos, or event invitations that support this declaration.</p>
    </>
  );
}
