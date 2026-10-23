import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { createDeclaration, submitDeclaration, updateDeclaration, uploadDeclarationFile } from "@/services/api";
import type { Declaration } from "@/types/declaration";
import type { UploadFile } from "@/app/components/SupportingDocumentsUpload";
import { notifyError, notifySuccess } from "@/app/components/notify";

interface UseDeclarationMutationsOptions {
  draft?: Declaration | null;
  files: UploadFile[];
  setFiles: Dispatch<SetStateAction<UploadFile[]>>;
  pendingFilesRef: MutableRefObject<Array<File & { uploadId?: string }>>;
  buildPayload: () => Declaration | null | undefined;
  validate: () => boolean;
  onDraftSaved: () => void;
  onSubmitSuccess: (declaration: Declaration) => void;
  setSubmitError: (message: string) => void;
  setSubmitting: (value: boolean) => void;
}

export function useDeclarationMutations({
  draft, files, setFiles, pendingFilesRef, buildPayload, validate,
  onDraftSaved, onSubmitSuccess, setSubmitError, setSubmitting,
}: UseDeclarationMutationsOptions) {
  const syncUploadedFiles = useCallback(async (declaration: Declaration): Promise<Declaration> => {
    const committedFiles = files.filter((file) => !file.url.startsWith("data:"));
    const pendingFiles = pendingFilesRef.current;
    const uploadedFiles = pendingFiles.length > 0
      ? await Promise.all(pendingFiles.map((file) => uploadDeclarationFile(file, declaration.id)))
      : [];

    pendingFilesRef.current = [];
    const allFiles = [...committedFiles, ...uploadedFiles];
    setFiles(allFiles);
    return updateDeclaration(declaration.id, { files: allFiles });
  }, [files, pendingFilesRef, setFiles]);

  const handleSaveDraft = useCallback(async () => {
    const declaration = buildPayload();
    if (!declaration) return;
    try {
      const saved = draft
        ? await updateDeclaration(draft.id, { ...declaration, files: [] })
        : await createDeclaration({ ...declaration, files: [] });
      if (!saved) throw new Error("The declaration could not be saved.");
      await syncUploadedFiles(saved);
      onDraftSaved();
      notifySuccess("Draft saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save draft.";
      setSubmitError(message);
      notifyError(message);
    }
  }, [buildPayload, draft, onDraftSaved, setSubmitError, syncUploadedFiles]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;
    const declaration = buildPayload();
    if (!declaration) return;
    setSubmitting(true);
    setSubmitError("");

    let saved: Declaration | undefined;
    try {
      const persisted = draft
        ? await updateDeclaration(draft.id, { ...declaration, files: [] })
        : await createDeclaration({ ...declaration, files: [] });
      if (!persisted) throw new Error("The declaration could not be saved.");
      saved = persisted;
      const synced = await syncUploadedFiles(saved);
      const submitted = await submitDeclaration(synced.id);
      if (!submitted) throw new Error("The declaration could not be submitted.");
      onSubmitSuccess(submitted);
    } catch (error) {
      if (saved) {
        try {
          await updateDeclaration(saved.id, { status: "Draft" });
        } catch {
          // Preserve the original submission error.
        }
      }
      const message = error instanceof Error ? error.message : "Failed to submit declaration.";
      setSubmitError(message);
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  }, [buildPayload, draft, onSubmitSuccess, setSubmitError, setSubmitting, syncUploadedFiles, validate]);

  return { handleSaveDraft, handleSubmit };
}
