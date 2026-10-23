import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Check, AlertCircle, Send, X,
} from "lucide-react";
import { Sel } from "@/app/components/Sel"
import { FL } from "@/app/components/FL";
import { SupportingDocumentsUpload, UploadFile } from "@/app/components/SupportingDocumentsUpload";
import { DeclarationGuidanceSidebar } from "@/app/components/DeclarationGuidanceSidebar";
import { FS, FORM_SECTIONS } from "@/app/components/FS";
import { PURPLE, F, inp, GRADIENT_PRIMARY, GRADIENT_ACCENT, INFO_BG, DEFAULT_HIGH_VALUE_THRESHOLD, DEFAULT_MEDIUM_VALUE_THRESHOLD, DEFAULT_MAXIMUM_VALUE } from "@/config/theme";
import { Declaration } from "@/types/declaration";
import { createDeclaration, submitDeclaration, uploadDeclarationFile } from "@/services/api";
import { downloadFile } from "@/services/download";
import { notifySuccess, notifyError } from "@/app/components/notify";
import { useUser } from "@/app/auth/UserContext";
import { fetchConfig, fetchUserById, updateDeclaration, fetchManagers, fetchDepartments, fetchOrganizations } from "@/services/api";
import { formatRandValue, getPriority, OCCASION_OPTIONS, parseRandInput, validateDeclarationForm } from "./newDeclarationModel";
import type { DeclarationFormState } from "./newDeclarationModel";

// determineRuleId now handled server-side via workflowService.determineRuleId (2-tier: >=high → rule-2)

function ErrInp({ field, errors, ...props }: { field: string; errors: Record<string, string> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`${inp} ${errors[field] ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600 hover:border-red-400" : ""}`}
    />
  );
}

export function NewDeclarationScreen({
  onSubmitSuccess,
  onDraftSaved,
  draft,
}: {
  onSubmitSuccess: (data: Declaration) => void;
  onDraftSaved: () => void;
  draft?: Declaration | null;
}) {
  const { user } = useUser();
  const [config, setConfig] = useState({ highValueThreshold: DEFAULT_HIGH_VALUE_THRESHOLD, mediumValueThreshold: DEFAULT_MEDIUM_VALUE_THRESHOLD, slaEscalationDays: 7, maxDeclarationsPerCounterparty: 10, maximumValue: DEFAULT_MAXIMUM_VALUE, emailTemplate: "" });
  const [lineManagerName, setLineManagerName] = useState("");
  const [managers, setManagers] = useState<{ id: number; name: string; email: string; position: string; department: string }[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [organizations, setOrganizations] = useState<{ id: number; name: string; shortCode: string }[]>([]);
  const [managerSearch, setManagerSearch] = useState("");
  const [showManagerDropdown, setShowManagerDropdown] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchConfig({ signal: controller.signal })
      .then(setConfig)
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === "AbortError") return; setLoadWarning("System configuration could not be loaded — default thresholds apply. Ask an administrator to check the configuration before submitting high-value declarations."); });
    fetchOrganizations({ signal: controller.signal })
      .then(setOrganizations)
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === "AbortError") return; setLoadWarning("Organization data could not be loaded — company and department options may be incomplete."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    // lineManager is display text; only numeric references need a lookup.
    const lm = user?.lineManager;
    if (!lm) {
      setLineManagerName("");
      return;
    }
    if (/^\d+$/.test(lm.trim())) {
      const controller = new AbortController();
      fetchUserById(Number(lm), { signal: controller.signal }).then((u) => { if (!cancelled) setLineManagerName(u?.name || ""); }).catch((err: unknown) => { if (!(err instanceof DOMException && err.name === "AbortError")) console.error("Failed to fetch line manager:", err); });
      return () => { cancelled = true; controller.abort(); };
    } else {
      setLineManagerName(lm);
    }
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (organizations.length > 0) {
      setFormState((f) => {
        if (f.company) return f;
        // Profile-owned company: only the user's own organization. No
        // first-organization fallback — global users keep an empty company.
        const userOrg = organizations.find((o) => o.id === user?.organizationId);
        if (!userOrg) return f;
        return { ...f, company: userOrg.name, organizationId: userOrg.id };
      });
    }
  }, [organizations, user?.organizationId]);

  useEffect(() => {
    if (lineManagerName) {
      setFormState((f) => f.lineManager ? f : { ...f, lineManager: lineManagerName });
    }
  }, [lineManagerName]);

  useEffect(() => {
    if (!draft) return;
    const occasionInList = OCCASION_OPTIONS.includes(draft.occasion);
    setFormState({
      employeeName: draft.employee || "",
      employeeCode: draft.teamMemberNumber || "",
      lineManager: draft.lineManager || "",
      company: draft.company || "",
      organizationId: draft.organizationId || "",
      department: draft.department || "",
      team: draft.team || "",
      position: draft.position || "",
      partyType: draft.from || "",
      Counterparty: draft.counterparty || "",
      contactPerson: draft.contactPerson || "",
      existingRelationship: draft.relationship || "",
      contractNegotiation: draft.contractNegotiation || "",
      biddingProcess: draft.biddingProcess || "",
      occasion: occasionInList ? draft.occasion : "Other",
      occasionOther: occasionInList ? "" : draft.occasion || "",
      date: draft.date || "",
      value: String(draft.value || ""),
      currency: "ZAR",
      substantiation: draft.substantiation || "",
      instances: draft.instances || "1",
      description: draft.description || "",
    });
    setReceivedGiven(draft.receivedGiven || "Received");
    setCategory(draft.type || "");
    setFiles(draft.files || []);
    setErrors({});
    setSubmitError("");
    if (user?.role === "teamMember") {
      // Draft identity stays profile-owned even when editing a saved draft.
      setFormState((f) => ({
        ...f,
        lineManager: lineManagerName || f.lineManager,
        department: user?.department || f.department,
      }));
    }
  }, [draft]);


  const [receivedGiven, setReceivedGiven] = useState("Received");
  const [category, setCategory] = useState("");
  const [activeSection, setActiveSection] = useState("sec-team");
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<{ title: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  // Visible when business-rule inputs (config, organizations) fail to load —
  // silent fallbacks are not acceptable where thresholds and scoping apply.
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isValueFocused, setIsValueFocused] = useState(false);
  const pendingFilesRef = useRef<Array<File & { uploadId?: string }>>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setFormState] = useState<DeclarationFormState>({
    employeeName: user?.name || "",
    employeeCode: user?.teamMemberNumber || "",
    lineManager: lineManagerName,
    company: "",
    organizationId: "" as number | "",
    department: user?.department || "",
    team: "",
    position: user?.position || "",
    partyType: "",
    Counterparty: "",
    contactPerson: "",
    existingRelationship: "",
    contractNegotiation: "",
    biddingProcess: "",
    occasion: "",
    occasionOther: "",
    date: "",
    value: "",
    currency: "ZAR",
    substantiation: "",
    instances: "1",
    description: "",
  });

  const CAPITALIZE_FIELDS = new Set(["Counterparty", "contactPerson"]);

  const setF = (k: string, v: string) => {
    const val = CAPITALIZE_FIELDS.has(k) ? v.charAt(0).toUpperCase() + v.slice(1) : v;
    setFormState((f) => ({ ...f, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
    setSubmitError("");
  };

  useEffect(() => {
    const el = scrollRef.current;
    const scrollRoot = el?.closest("main") as HTMLElement | null;
    if (!el || !scrollRoot) return;
    const onScroll = () => {
      const rootTop = scrollRoot.getBoundingClientRect().top;
      for (const s of [...FORM_SECTIONS].reverse()) {
        const node = el.querySelector(`#${s.id}`) as HTMLElement | null;
        if (node && node.getBoundingClientRect().top - rootTop <= 36) {
          setActiveSection(s.id);
          return;
        }
      }
    };
    onScroll();
    scrollRoot.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollRoot.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!uploadError) return;
    const t = setTimeout(() => setUploadError(null), 5000);
    return () => clearTimeout(t);
  }, [uploadError]);

  // Per-org departments and managers — refetch when selected company changes.
  // Skipped for profile-locked team members: identity fields are read-only
  // and the manager/department pickers are not rendered.
  useEffect(() => {
    if (user?.role === "teamMember") return;
    const orgId = form.organizationId || user?.organizationId;
    if (!orgId) return;
    const controller = new AbortController();
    fetchManagers(orgId, { signal: controller.signal }).then(setManagers).catch((err: unknown) => { if (!(err instanceof DOMException && err.name === "AbortError")) console.error("Failed to fetch managers:", err); });
    fetchDepartments(orgId, { signal: controller.signal }).then(setDepartments).catch((err: unknown) => { if (!(err instanceof DOMException && err.name === "AbortError")) console.error("Failed to fetch departments:", err); });
    return () => controller.abort();
  }, [form.organizationId, user?.organizationId, user?.role]);

  useEffect(() => {
    if (!showManagerDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-manager-dropdown]")) {
        setShowManagerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showManagerDropdown]);

  const jumpTo = (id: string) => {
    const node = scrollRef.current?.querySelector(`#${id}`) as HTMLElement | null;
    const scrollRoot = scrollRef.current?.closest("main") as HTMLElement | null;
    if (node && scrollRoot) {
      const topPos = node.getBoundingClientRect().top + scrollRoot.scrollTop - scrollRoot.getBoundingClientRect().top;
      const maxScrollTop = Math.max(0, scrollRoot.scrollHeight - scrollRoot.clientHeight);
      const nextScrollTop = Math.min(Math.max(topPos - 24, 0), maxScrollTop);
      setActiveSection(id);
      scrollRoot.scrollTo({ top: nextScrollTop, behavior: "smooth" });
    } else {
      node?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const ALLOWED = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  const MAX_SIZE = 20 * 1_048_576;

  const processFiles = useCallback(async (rawFiles: FileList | null) => {
    if (!rawFiles) return;
    for (const file of Array.from(rawFiles)) {
      if (!ALLOWED.includes(file.type)) {
        setUploadError({
          title: "Unsupported file type",
          message: `${file.name} cannot be uploaded. Use PDF, PNG, JPG, DOC, or DOCX files.`,
        });
        continue;
      }
      if (file.size > MAX_SIZE) {
        setUploadError({
          title: "File is too large",
          message: `${file.name} exceeds the 20 MB limit.`,
        });
        continue;
      }
      setUploadError(null);
      pendingFilesRef.current = [...pendingFilesRef.current, file];
        const uploadId = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const pendingFile = file as File & { uploadId?: string };
        pendingFile.uploadId = uploadId;
        pendingFilesRef.current[pendingFilesRef.current.length - 1] = pendingFile;
        const reader = new FileReader();
      reader.onload = () => {
        // readAsDataURL always resolves to a string on success; anything
        // else is a read failure, not a case for an object URL (which would
        // leak, since picked files are never revoked).
        const result = reader.result;
        if (typeof result !== "string") {
          setUploadError({ title: "Could not read file", message: `${file.name} could not be previewed. Please try again.` });
          return;
        }
        setFiles((f) => [
          ...f,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            url: result,
            uploadId,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const isTeamMember = user?.role === "teamMember";
  const profileIdentityLocked = Boolean(isTeamMember);
  // Mirrors the backend rule: a self-service team member must have a
  // resolvable line manager; department-less (e.g. global) profiles keep
  // going with a legacy value.
  const profileManagerMissing = profileIdentityLocked && !lineManagerName.trim();

  const validate = () => {
    // Profile-owned identity is locked for team members: company, department,
    // and manager come from the authenticated profile, not editable inputs.
    // Block submission with an actionable error when no manager resolves
    // instead of selecting a fallback.
    if (profileManagerMissing) {
      setSubmitError("Your profile is incomplete: a line manager is required before creating a declaration. Ask an administrator to update your profile.");
      jumpTo("sec-team");
      return false;
    }
    const errs = validateDeclarationForm(form, category, config, profileIdentityLocked);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const sectionMap: Record<string, string> = {
        employeeName: "sec-team", employeeCode: "sec-team", lineManager: "sec-team",
        company: "sec-team", department: "sec-team", position: "sec-team",
        partyType: "sec-declaration", Counterparty: "sec-declaration",
        contactPerson: "sec-declaration", existingRelationship: "sec-declaration",
        contractNegotiation: "sec-declaration", biddingProcess: "sec-declaration",
        category: "sec-ghe", description: "sec-ghe", date: "sec-ghe", value: "sec-ghe",
        occasionOther: "sec-ghe",
        substantiation: "sec-ghe",
      };
      jumpTo(sectionMap[Object.keys(errs)[0]] ?? "sec-team");
      return false;
    }
    return true;
  };

  const handleClear = () => {
    setFormState((prev) => ({
      employeeName: prev.employeeName, employeeCode: prev.employeeCode, lineManager: prev.lineManager,
      company: prev.company, organizationId: prev.organizationId, department: prev.department, team: prev.team, position: prev.position,
      partyType: "", Counterparty: "", contactPerson: "",
      existingRelationship: "", contractNegotiation: "", biddingProcess: "", occasion: "",
      occasionOther: "", date: "", value: "", currency: "ZAR", substantiation: "", instances: "1",
      description: "",
    }));
    setCategory("");
    setReceivedGiven("Received");
    setFiles([]);
    setErrors({});
    setSubmitError("");
    setShowClearConfirm(false);
  };

  const buildDeclarationPayload = (): Declaration | null => {
    if (!user) return null;
    const value = Number(form.value || 0);
    const requiresSubstantiation = Number.isFinite(value) && value >= config.highValueThreshold;
    const requiresOccasionOther = form.occasion === "Other";
    const priority = getPriority(value, config.highValueThreshold, config.mediumValueThreshold);

    return {
      // The public GHE reference is server-assigned on create (the backend
      // generates it with a collision guard and ignores any client value):
      // only carry an id for draft updates.
      id: draft?.id ?? "",
      employee: form.employeeName,
      employeeId: user.id,
      teamMemberNumber: form.employeeCode,
      lineManager: form.lineManager,
      company: form.company,
      organizationId: form.organizationId || undefined,
      department: form.department,
      team: form.team,
      position: form.position,
      receivedGiven,
      from: form.partyType,
      counterparty: form.Counterparty,
      contactPerson: form.contactPerson,
      relationship: form.existingRelationship,
      contractNegotiation: form.contractNegotiation,
      biddingProcess: form.biddingProcess,
      type: category,
      date: form.date,
      submitted: new Date().toISOString().slice(0, 10),
      value: Number.isFinite(value) ? value : 0,
      occasion: requiresOccasionOther ? form.occasionOther : form.occasion,
      description: form.description,
      instances: form.instances || "1",
      publicOfficial: form.partyType === "Public Official" ? "Yes" : "No",
      substantiation: requiresSubstantiation ? form.substantiation : "",
      approver: "",
      status: draft?.status || "Draft",
      priority,
      files,
    };
  };

  const syncUploadedFiles = async (declaration: Declaration): Promise<Declaration> => {
    const committedFiles = files.filter((f) => !f.url.startsWith("data:"));
    const newPendingFiles = pendingFilesRef.current;

    const uploadedFiles = newPendingFiles.length > 0
      ? await Promise.all(newPendingFiles.map((file) => uploadDeclarationFile(file, declaration.id)))
      : [];

    pendingFilesRef.current = [];
    const allFiles = [...committedFiles, ...uploadedFiles];
    setFiles(allFiles);
    return updateDeclaration(declaration.id, { files: allFiles });
  };

  const handleSaveDraft = async () => {
    const declaration = buildDeclarationPayload();
    if (!declaration) return;
    try {
      if (draft) {
        const saved = await updateDeclaration(draft.id, { ...declaration, files: [] });
        await syncUploadedFiles(saved);
      } else {
        const saved = await createDeclaration({ ...declaration, files: [] });
        await syncUploadedFiles(saved);
      }
      onDraftSaved();
      notifySuccess("Draft saved.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save draft.";
      setSubmitError(message);
      notifyError(message);
    }
  };

  // createWorkflow is handled by the backend on submission

  const handleSubmit = async () => {
    if (!validate()) return;
    const declaration = buildDeclarationPayload();
    if (!declaration) return;
    setSubmitting(true);
    setSubmitError("");

    let saved: Declaration | undefined;
    try {
      if (draft) {
        saved = await updateDeclaration(draft.id, { ...declaration, files: [] });
      } else {
        saved = await createDeclaration({ ...declaration, files: [] });
      }
      const synced = await syncUploadedFiles(saved);
      const submitted = await submitDeclaration(synced.id);
      onSubmitSuccess(submitted);
    } catch (err) {
      // Best-effort rollback to Draft: guarded so a failed rollback cannot
      // mask the original submission error with an unhandled rejection.
      if (saved) {
        try {
          await updateDeclaration(saved.id, { status: "Draft" });
        } catch {
          // Original error below stays authoritative.
        }
      }
      const message = err instanceof Error ? err.message : "Failed to submit declaration.";
      setSubmitError(message);
      notifyError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const partyOptions = ["Supplier", "Customer", "Team Member", "Public Official"];
  const ynu = ["Yes", "No", "N/A"];
  const categoryDefs: Record<string, string> = {
    Gift: "Anything of value, including cash, vouchers, goods, services, preferential discounts or favours.",
    Hospitality: "Accommodation, travel, conferences, tickets or formal business functions.",
    Entertainment: "Meals, events, sporting or cultural activities or recreational activities.",
  };


  const valueNum = Number(form.value || 0);
  const requiresSubstantiation = Number.isFinite(valueNum) && valueNum >= config.highValueThreshold;
  const requiresOccasionOther = form.occasion === "Other";

  return (
    <div className="flex items-start gap-3 max-w-none lg:items-stretch">
      {uploadError && (
        <div className="fixed top-5 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_18px_50px_rgba(79,29,149,0.18)]" style={F}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: GRADIENT_ACCENT }}>
              <AlertCircle size={20} className="text-purple-950" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">{uploadError.title}</p>
              <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{uploadError.message}</p>
            </div>
            <button
              onClick={() => setUploadError(null)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-purple-50 hover:text-purple-700 transition-colors"
              aria-label="Dismiss upload error"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <DeclarationGuidanceSidebar activeSection={activeSection} onNavigate={jumpTo} />

      <div ref={scrollRef} className="flex-1 min-w-0 space-y-7 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-5 border-b border-border gap-4">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight text-foreground">New Declaration</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fields marked <span className="text-red-400 font-bold">*</span> are mandatory.
            </p>
          </div>
        </div>

        <FS id="sec-team" num="1" title="Team Member Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-5">
            <div>
              <FL htmlFor="employee-name" errorId="employee-name-error" required error={errors.employeeName}>Team Member Name</FL>
              <ErrInp id="employee-name" aria-describedby="employee-name-error" aria-invalid={!!errors.employeeName} errors={errors} field="employeeName" value={form.employeeName} onChange={(e) => setF("employeeName", e.target.value)} maxLength={100} />
            </div>
            <div>
              <FL htmlFor="employee-code" errorId="employee-code-error" error={errors.employeeCode}>Team Member Code</FL>
              <ErrInp id="employee-code" aria-describedby="employee-code-error" aria-invalid={!!errors.employeeCode} errors={errors} field="employeeCode" value={form.employeeCode} onChange={(e) => setF("employeeCode", e.target.value)} placeholder="e.g. HB-204478" maxLength={50} />
            </div>
            <div>
              <FL htmlFor="company" errorId="company-error" required error={errors.company}>Company</FL>
              {profileIdentityLocked ? (
                <input id="company" type="text" value={form.company || "No organization (global profile)"} disabled readOnly className={`${inp} bg-muted text-muted-foreground`} aria-label="Company (from your profile)" />
              ) : (
              <Sel id="company" aria-describedby="company-error" aria-invalid={!!errors.company} value={form.company} onChange={(v) => {
                const org = organizations.find((o) => o.name === v);
                setF("company", v);
                setFormState((f) => ({ ...f, organizationId: org?.id || "", department: "", lineManager: "" }));
                setManagerSearch("");
              }} className={errors.company ? "border-red-500 bg-red-50" : ""}>
                <option value="">Select company…</option>
                {organizations.map((o) => <option key={o.id} value={o.name}>{o.name}</option>)}
              </Sel>
              )}
            </div>
            <div>
              <FL htmlFor="department" errorId="department-error" required error={errors.department}>Department</FL>
              {profileIdentityLocked ? (
                <input id="department" type="text" value={form.department} disabled readOnly className={`${inp} bg-muted text-muted-foreground`} aria-label="Department (from your profile)" />
              ) : (
              <Sel id="department" aria-describedby="department-error" aria-invalid={!!errors.department} value={form.department} onChange={(v) => setF("department", v)} className={errors.department ? "border-red-500 bg-red-50" : ""}>
                <option value="">Select department…</option>
                {departments.map((d) => <option key={d}>{d}</option>)}
              </Sel>
              )}
            </div>
            <div>
              <FL htmlFor="position" errorId="position-error" required error={errors.position}>Team Member Role/Position</FL>
              <ErrInp id="position" aria-describedby="position-error" aria-invalid={!!errors.position} errors={errors} field="position" value={form.position} onChange={(e) => setF("position", e.target.value)} maxLength={100} />
            </div>
            <div>
              <FL htmlFor="line-manager" errorId="line-manager-error" required error={errors.lineManager}>Approving Manager Name</FL>
              {profileIdentityLocked ? (
                <input id="line-manager" type="text" value={form.lineManager} disabled readOnly className={`${inp} bg-muted text-muted-foreground`} aria-label="Approving manager (from your profile)" />
              ) : (
              <div className="relative" data-manager-dropdown>
                <input id="line-manager" aria-describedby="line-manager-error" aria-invalid={!!errors.lineManager} type="text" className={`${inp} ${errors.lineManager ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600 hover:border-red-400" : ""}`} value={managerSearch || form.lineManager} onChange={(e) => { setManagerSearch(e.target.value); setShowManagerDropdown(true); setF("lineManager", e.target.value); }} onFocus={() => { setManagerSearch(""); setShowManagerDropdown(true); }} placeholder="Search for manager…" maxLength={100} />
                {showManagerDropdown && managers.length > 0 && <div className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-border bg-white shadow-lg">
                  {managers.filter((m) => !managerSearch || m.name.toLowerCase().includes(managerSearch.toLowerCase())).map((m) => <button key={m.id} type="button" className="w-full text-left px-4 py-2.5 text-sm hover:bg-purple-50 transition-colors border-b border-border/50 last:border-0" onClick={() => { setFormState((f) => ({ ...f, lineManager: m.name })); setManagerSearch(""); setShowManagerDropdown(false); setErrors((e) => ({ ...e, lineManager: "" })); }}><span className="font-semibold">{m.name}</span><span className="text-xs text-muted-foreground ml-2">({m.position})</span></button>)}
                  {managers.filter((m) => !managerSearch || m.name.toLowerCase().includes(managerSearch.toLowerCase())).length === 0 && <div className="px-4 py-2.5 text-sm text-muted-foreground">No managers found</div>}
                </div>}
              </div>
              )}
            </div>
          </div>
        </FS>

        <FS id="sec-declaration" num="2" title="Declaration Details">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <div className="flex flex-col">
                <FL htmlFor="received-given" required>Did you receive or give a Gift, Hospitality or Entertainment?</FL>
                <div className="mt-auto">
                  <Sel id="received-given" value={receivedGiven} onChange={setReceivedGiven}>
                    <option>Received</option>
                    <option>Given</option>
                  </Sel>
                </div>
              </div>
              <div className="flex flex-col">
                <FL htmlFor="party-type" errorId="party-type-error" required error={errors.partyType}>
                  {receivedGiven === "Received" ? "Who did you receive a Gift, Hospitality or Entertainment from?" : "Who did you give a Gift, Hospitality or Entertainment to?"}
                </FL>
                <div className="mt-auto">
                  <Sel
                    id="party-type" aria-describedby="party-type-error" aria-invalid={!!errors.partyType} value={form.partyType}
                    onChange={(v) => setF("partyType", v)}
                    className={errors.partyType ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600" : ""}
                  >
                    <option value="">Select…</option>
                    {partyOptions.map((o) => <option key={o}>{o}</option>)}
                  </Sel>
                </div>
              </div>
            </div>
            <div>
              <FL htmlFor="counterparty" errorId="counterparty-error" required hint="Full Name of the organisation or Team Member" error={errors.Counterparty}>
                Name of the Supplier, Customer, Team Member or Public Official
              </FL>
              <input
                className={`${inp} ${errors.Counterparty ? "border-red-400" : ""}`}
                 id="counterparty" aria-describedby="counterparty-error" aria-invalid={!!errors.Counterparty} value={form.Counterparty}
                 onChange={(e) => setF("Counterparty", e.target.value)}
                placeholder="Full legal name"
                maxLength={200}
              />
            </div>
            <div>
              <FL htmlFor="contact-person" errorId="contact-person-error" required error={errors.contactPerson}>
                Name of the person giving or receiving the GHE at the Supplier or Customer, or name of the Public Official
              </FL>
              <input
                className={`${inp} ${errors.contactPerson ? "border-red-400" : ""}`}
                id="contact-person" aria-describedby="contact-person-error" aria-invalid={!!errors.contactPerson} value={form.contactPerson}
                onChange={(e) => setF("contactPerson", e.target.value)}
                placeholder="e.g. Ahmed Al-Rashid"
                maxLength={200}
              />
            </div>
            <div className="space-y-5">
              <div>
                <FL htmlFor="contract-negotiation" errorId="contract-negotiation-error" required error={errors.contractNegotiation}>Are we currently negotiating a contract with the Supplier or Customer?</FL>
                <Sel id="contract-negotiation" aria-describedby="contract-negotiation-error" aria-invalid={!!errors.contractNegotiation} value={form.contractNegotiation} onChange={(v) => setF("contractNegotiation", v)} className={errors.contractNegotiation ? "border-red-400" : ""}>
                  <option value="">Select…</option>
                  {ynu.map((o) => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL htmlFor="bidding-process" errorId="bidding-process-error" required error={errors.biddingProcess}>Is the Supplier or Potential Supplier involved in a bidding process with us?</FL>
                <Sel id="bidding-process" aria-describedby="bidding-process-error" aria-invalid={!!errors.biddingProcess} value={form.biddingProcess} onChange={(v) => setF("biddingProcess", v)} className={errors.biddingProcess ? "border-red-400" : ""}>
                  <option value="">Select…</option>
                  {ynu.map((o) => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL htmlFor="existing-relationship" errorId="existing-relationship-error" required error={errors.existingRelationship}>Is there an existing or imminent business relationship with the Supplier or Customer?</FL>
                <Sel id="existing-relationship" aria-describedby="existing-relationship-error" aria-invalid={!!errors.existingRelationship} value={form.existingRelationship} onChange={(v) => setF("existingRelationship", v)} className={errors.existingRelationship ? "border-red-400" : ""}>
                  <option value="">Select…</option>
                  {ynu.map((o) => <option key={o}>{o}</option>)}
                </Sel>
              </div>
            </div>
          </div>
        </FS>

        <FS id="sec-ghe" num="3" title="Gift, Hospitality or Entertainment Details">
          <div className="space-y-5">
            <div>
              <FL htmlFor="category" errorId="category-error" required error={errors.category}>What category does the nature of the GHE fall into?</FL>
              <Sel
                id="category" aria-describedby="category-error" aria-invalid={!!errors.category} value={category}
                onChange={(v) => { setCategory(v); setErrors((e) => ({ ...e, category: "" })); }}
                className={errors.category ? "border-red-400" : ""}
              >
                <option value="">Select category…</option>
                <option>Gift</option>
                <option>Hospitality</option>
                <option>Entertainment</option>
              </Sel>
              {category && (
                <div className="mt-2.5 flex items-start gap-2.5 p-3.5 rounded-xl border border-primary/10" style={{ background: INFO_BG }}>
                  <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{category}:</span> {categoryDefs[category]}
                  </p>
                </div>
              )}
            </div>
            <div>
              <FL htmlFor="description" errorId="description-error" required error={errors.description}>Please describe the nature of the GHE in detail</FL>
              <textarea
                id="description" aria-describedby="description-error" aria-invalid={!!errors.description} className={`${inp} h-auto resize-none ${errors.description ? "border-red-400" : ""}`}
                rows={4}
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200."
                maxLength={5000}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{form.description.length}/5000</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div className="flex flex-col">
                  <FL htmlFor="occasion" errorId="occasion-error" error={errors.occasionOther}>Reason/Occasion for the GHE</FL>
                <Sel id="occasion" aria-describedby="occasion-error" aria-invalid={!!errors.occasionOther} value={form.occasion} onChange={(v) => setF("occasion", v)}>
                  <option value="">Select reason…</option>
                  {OCCASION_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                </Sel>
                {requiresOccasionOther && (
                  <input
                    id="occasion-other" aria-describedby="occasion-other-error" aria-invalid={!!errors.occasionOther} className={`${inp} mt-3 ${errors.occasionOther ? "border-red-400" : ""}`}
                    value={form.occasionOther}
                    onChange={(e) => setF("occasionOther", e.target.value)}
                    placeholder="Please specify the reason"
                    maxLength={200}
                  />
                )}
              </div>
              <div className="flex flex-col">
                  <FL htmlFor="date" errorId="date-error" required error={errors.date}>Date of GHE</FL>
                <input
                  type="date"
                  id="date" aria-describedby="date-error" aria-invalid={!!errors.date} className={`${inp} ${errors.date ? "border-red-400" : ""}`}
                  value={form.date}
                  onChange={(e) => setF("date", e.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                />
              </div>
            </div>
            <div>
              <FL htmlFor="value" hint="Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.">
                Rand Value or Equivalent Rand Value (including VAT)
              </FL>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">R</span>
                <input
                  id="value"
                  type="text"
                  inputMode="decimal"
                  aria-describedby="rand-value-error"
                  aria-invalid={Number(form.value) > (config.maximumValue ?? 1000000) ? "true" : "false"}
                  className={`${inp} pl-10 ${Number(form.value) > (config.maximumValue ?? 1000000) ? "border-[#c55aff] shadow-[0_0_0_4px_rgba(215,103,255,.19)] focus:border-[#b62dff] focus:shadow-[0_0_0_4px_rgba(215,103,255,.24)]" : ""}`}
                  value={form.value ? formatRandValue(form.value, !isValueFocused) : ""}
                  onFocus={(e) => {
                    setIsValueFocused(true);
                    e.currentTarget.select();
                  }}
                  onBlur={() => setIsValueFocused(false)}
                  onChange={(e) => {
                    const parsed = parseRandInput(e.target.value);
                    setF("value", parsed);
                  }}
                  placeholder="0.00"
                />
              </div>
              {Number(form.value) > (config.maximumValue ?? 1000000) && (
                <div id="rand-value-error" role="alert" className="field__error" style={{ display: "flex", alignItems: "center", minHeight: 52, marginTop: 18, padding: "13px 17px", border: "2px solid #ff918b", borderRadius: "17px 17px 0 0", background: "linear-gradient(90deg, #ffe8e4 0%, #ffd8d4 100%)", color: "#bd2826", fontSize: 14, lineHeight: "1.35" }}>
                  <svg className="field__error-icon" viewBox="0 0 24 24" aria-hidden="true" style={{ width: 17, height: 17, marginRight: 12, flex: "0 0 auto" }}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
                    <path d="M12 7.5v5.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                    <circle cx="12" cy="16.7" r="1.2" fill="currentColor" />
                  </svg>
                  <span>Maximum value exceeded. Please enter an amount of R{(config.maximumValue ?? 1000000).toLocaleString("en-ZA").replace(/,/g, " ")} or less to continue.</span>
                </div>
              )}
            </div>
            {requiresSubstantiation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  If the Rand Value including VAT exceeds <strong>R1,000.00</strong>, please substantiate why this Gift, Hospitality or Entertainment should be accepted or given.
                </p>
              </div>
              <textarea
                className={`w-full h-20 rounded-xl px-4 py-3 text-sm border bg-white focus:outline-none focus:ring-2 transition-all resize-none placeholder:text-muted-foreground/50 ${
                  errors.substantiation ? "border-red-400 focus:ring-red-300/40" : "border-amber-200 focus:ring-amber-300/40"
                }`}
                value={form.substantiation}
                onChange={(e) => setF("substantiation", e.target.value)}
                placeholder="Substantiation for value exceeding R1,000.00 (if applicable)…"
                maxLength={2000}
              />
              <p className="mt-1 text-right text-xs text-amber-700/80">{form.substantiation.length}/2000</p>
            </div>
            )}
          </div>
        </FS>

        <FS id="sec-docs" num="4" title="Supporting Documents">
          <SupportingDocumentsUpload
            files={files}
            dragging={dragging}
            onDraggingChange={setDragging}
            onFilesSelected={processFiles}
            onRemove={(fileId) => {
              pendingFilesRef.current = pendingFilesRef.current.filter((file) => file.uploadId !== fileId);
              setFiles((current) => current.filter((file) => (file.uploadId || `${file.name}-${file.size}`) !== fileId));
            }}
            onDownload={(file) => { downloadFile(file.url, file.name).catch((err: Error) => setSubmitError(err.message)); }}
          />
        </FS>

        <FS id="sec-undertaking" num="5" title="Declaration & Undertaking">
          <p className="text-sm text-muted-foreground mb-4">By submitting this declaration I undertake and confirm that:</p>
          <div className="space-y-2.5 mb-6">
            {[
              "My objectivity and impartiality has not been impacted by receiving or giving of the Gift, Hospitality or Entertainment.",
              "The execution of my duties has not been influenced and will not be influenced.",
              "I have complied with the Anti-Bribery and Corruption Policy.",
              "I have complied with the Gifts, Hospitality and Entertainment Policy.",
              "No conflict of interest or perceived conflict of interest has been created.",
              "The information provided is valid, accurate and complete.",
            ].map((item, i) => (
              <div
                key={i}
                className="group flex items-start gap-3 py-3 px-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:border-purple-200/60 hover:bg-purple-50/40"
              >
                <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:scale-110 group-hover:bg-purple-100 transition-all duration-300">
                  <Check size={10} style={{ color: PURPLE }} />
                </div>
                <p className="text-sm text-foreground leading-relaxed transition-colors group-hover:text-purple-950">{item}</p>
              </div>
            ))}
          </div>
          <div className="pt-6 mt-2 border-t border-slate-100">
            {loadWarning && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
                {loadWarning}
              </div>
            )}
            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="h-12 px-5 rounded-xl text-sm font-semibold border border-red-200 bg-white text-red-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
              >
                Clear Form
              </button>
              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button
                  onClick={handleSaveDraft}
                  className="h-12 px-6 rounded-xl text-sm font-semibold border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
                >
                  Save Draft
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="h-12 px-8 rounded-xl text-sm font-semibold text-white transition-all duration-300 ease-out flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(79,29,149,0.39)] hover:-translate-y-0.5 hover:border-yellow-400 hover:bg-yellow-400 hover:text-white hover:shadow-[0_8px_24px_rgba(250,204,21,0.35)] active:translate-y-0 active:scale-[0.98]"
                  style={{ background: GRADIENT_PRIMARY, border: "1px solid transparent", opacity: submitting ? 0.7 : 1 }}
                >
                  <Send size={14} /> {submitting ? "Submitting..." : "Submit Declaration"}
                </button>
              </div>
            </div>
            {showClearConfirm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-2xl">
                  <p className="text-sm font-bold text-foreground mb-2">Clear form?</p>
                  <p className="text-sm text-muted-foreground mb-5">All entered data including uploaded files will be lost. This cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      className="h-10 px-4 rounded-xl text-sm font-semibold border border-slate-200 bg-white hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClear}
                      className="h-10 px-4 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </FS>
      </div>

    </div>
  );
}










