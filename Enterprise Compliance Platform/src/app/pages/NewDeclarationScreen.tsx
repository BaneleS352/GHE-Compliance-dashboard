import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FileText, Upload, Download, Check, AlertCircle,
  Paperclip, Trash2, Send, X,
} from "lucide-react";
import { Sel } from "../components/Sel";
import { FL } from "../components/FL";
import { FS, FORM_SECTIONS } from "../components/FS";
import { Card } from "../components/Card";
import { PURPLE, F, inp } from "../../config/theme";
import { Declaration, UploadedFile } from "../../types/declaration";
import { createDeclaration } from "../../services/api";
import { useUser } from "../auth/UserContext";
import { fetchConfig, fetchUserById, updateDeclaration } from "../../services/api";

const determineRuleId = (value: number, highThreshold: number, mediumThreshold: number): string => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "rule-1";
  if (value > highThreshold) return "rule-3";
  if (value > mediumThreshold) return "rule-2";
  return "rule-1";
};

const getPriority = (value: number, highThreshold: number, mediumThreshold: number): "High" | "Medium" | "Low" => {
  if (value > highThreshold) return "High";
  if (value > mediumThreshold) return "Medium";
  return "Low";
};

export function NewDeclarationScreen({
  onSubmitSuccess,
  onDraftSaved,
}: {
  onSubmitSuccess: (data: Declaration) => void;
  onDraftSaved: () => void;
}) {
  const { user } = useUser();
  const [config, setConfig] = useState({ highValueThreshold: 2000, mediumValueThreshold: 500, slaEscalationDays: 7, maxDeclarationsPerCounterparty: 10, emailTemplate: "" });
  const [lineManagerName, setLineManagerName] = useState("");

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  useEffect(() => {
    if (user?.lineManager) {
      fetchUserById(user.lineManager).then((u) => setLineManagerName(u?.name || ""));
    }
  }, [user]);

  useEffect(() => {
    if (lineManagerName) {
      setF("lineManager", lineManagerName);
    }
  }, [lineManagerName]);

  const formatRandValue = (value: string, fixedDecimals = false) => {
    if (!value) return "";
    const [integerPartRaw, decimalPartRaw = ""] = value.split(".");
    const integerPart = (integerPartRaw || "0").replace(/^0+(?=\d)/, "") || "0";
    const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    if (fixedDecimals) {
      return `${groupedInteger}.${(decimalPartRaw + "00").slice(0, 2)}`;
    }
    return decimalPartRaw ? `${groupedInteger}.${decimalPartRaw.slice(0, 2)}` : groupedInteger;
  };

  const parseRandInput = (raw: string) => {
    const cleaned = raw.replace(/[Rr\s]/g, "").replace(/[^\d.,]/g, "");
    if (!cleaned) return "";
    const separatorIndex = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
    if (separatorIndex === -1) {
      const integerOnly = cleaned.replace(/[^\d]/g, "");
      return integerOnly.replace(/^0+(?=\d)/, "") || "0";
    }
    const integerPart = cleaned.slice(0, separatorIndex).replace(/[^\d]/g, "");
    const decimalPart = cleaned.slice(separatorIndex + 1).replace(/[^\d]/g, "").slice(0, 2);
    const normalizedInteger = integerPart.replace(/^0+(?=\d)/, "") || "0";
    return decimalPart ? `${normalizedInteger}.${decimalPart}` : normalizedInteger;
  };

  const [receivedGiven, setReceivedGiven] = useState("Received");
  const [category, setCategory] = useState("");
  const [activeSection, setActiveSection] = useState("sec-team");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadError, setUploadError] = useState<{ title: string; message: string } | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isValueFocused, setIsValueFocused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [form, setFormState] = useState({
    employeeName: user?.name || "",
    employeeCode: user?.teamMemberNumber || "",
    lineManager: lineManagerName,
    company: "Hollywoodbets Group",
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
    instances: "",
    description: "",
  });

  const setF = (k: string, v: string) => {
    setFormState((f) => ({ ...f, [k]: v }));
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
      const reader = new FileReader();
      reader.onload = () => {
        setFiles((f) => [
          ...f,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            url: typeof reader.result === "string" ? reader.result : URL.createObjectURL(file),
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  };

  const validate = () => {
    const value = Number(form.value || 0);
    const requiresSubstantiation = Number.isFinite(value) && value > config.highValueThreshold;
    const requiresOccasionOther = form.occasion === "Other";

    const errs: Record<string, string> = {};
    if (!form.employeeName.trim())       errs.employeeName = "Required";
    if (!form.employeeCode.trim())       errs.employeeCode = "Required";
    if (!form.lineManager.trim())        errs.lineManager = "Required";
    if (!form.company.trim())            errs.company = "Required";
    if (!form.department.trim())         errs.department = "Required";
    if (!form.position.trim())           errs.position = "Required";
    if (!form.partyType)                 errs.partyType = "Required";
    if (!form.Counterparty.trim())       errs.Counterparty = "Required";
    if (!form.contactPerson.trim())      errs.contactPerson = "Required";
    if (!form.existingRelationship)      errs.existingRelationship = "Required";
    if (!form.contractNegotiation)       errs.contractNegotiation = "Required";
    if (!form.biddingProcess)            errs.biddingProcess = "Required";
    if (!category)                       errs.category = "Required";
    if (!form.description.trim())        errs.description = "Required";
    if (!form.date)                      errs.date = "Required";
    if (!form.instances)                 errs.instances = "Required";
    if (requiresOccasionOther && !form.occasionOther.trim()) errs.occasionOther = "Required";
    if (requiresSubstantiation && !form.substantiation.trim()) errs.substantiation = "Required";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      const sectionMap: Record<string, string> = {
        employeeName: "sec-team", employeeCode: "sec-team", lineManager: "sec-team",
        company: "sec-team", department: "sec-team", position: "sec-team",
        partyType: "sec-declaration", Counterparty: "sec-declaration",
        contactPerson: "sec-declaration", existingRelationship: "sec-declaration",
        contractNegotiation: "sec-declaration", biddingProcess: "sec-declaration",
        category: "sec-ghe", description: "sec-ghe", date: "sec-ghe", instances: "sec-ghe",
        occasionOther: "sec-ghe",
        substantiation: "sec-ghe",
      };
      jumpTo(sectionMap[Object.keys(errs)[0]] ?? "sec-team");
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!user) return;
    const value = Number(form.value || 0);
    const requiresSubstantiation = Number.isFinite(value) && value > config.highValueThreshold;
    const requiresOccasionOther = form.occasion === "Other";
    const priority = getPriority(value, config.highValueThreshold, config.mediumValueThreshold);
    const declaration: Declaration = {
      id: `GHE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`,
      employee: form.employeeName,
      employeeId: user.id,
      teamMemberNumber: form.employeeCode,
      lineManager: form.lineManager,
      company: form.company,
      department: form.department,
      team: form.team,
      position: form.position,
      receivedGiven,
      from: form.partyType,
      Counterparty: form.Counterparty,
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
      instances: form.instances,
      publicOfficial: form.partyType === "Public Official" ? "Yes" : "No",
      substantiation: requiresSubstantiation ? form.substantiation : "",
      approver: form.lineManager,
      status: "Draft",
      priority,
      files: files.map((f) => ({ name: f.name, size: f.size, type: f.type, url: f.url, data: f.data || "" })),
    };
    try {
      await createDeclaration(declaration);
      onDraftSaved();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to save draft.");
    }
  };

  // createWorkflow is handled by the backend on submission

  const handleSubmit = async () => {
    if (!validate()) return;
    if (!user) return;
    setSubmitting(true);
    setSubmitError("");

    const value = Number(form.value || 0);
    const requiresSubstantiation = Number.isFinite(value) && value > config.highValueThreshold;
    const requiresOccasionOther = form.occasion === "Other";
    const priority = getPriority(value, config.highValueThreshold, config.mediumValueThreshold);
    const declaration: Declaration = {
      id: `GHE-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`,
      employee: form.employeeName,
      employeeId: user.id,
      teamMemberNumber: form.employeeCode,
      lineManager: form.lineManager,
      company: form.company,
      department: form.department,
      team: form.team,
      position: form.position,
      receivedGiven,
      from: form.partyType,
      Counterparty: form.Counterparty,
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
      instances: form.instances,
      publicOfficial: form.partyType === "Public Official" ? "Yes" : "No",
      substantiation: requiresSubstantiation ? form.substantiation : "",
      approver: form.lineManager,
      status: "Pending",
      priority,
      files: files.map((f) => ({ name: f.name, size: f.size, type: f.type, url: f.url, data: f.data || "" })),
    };

    let saved: Declaration | undefined;
    try {
      saved = await createDeclaration(declaration);
      onSubmitSuccess(saved);
    } catch (err) {
      if (saved) await updateDeclaration(saved.id, { status: "Draft" });
      setSubmitError(err instanceof Error ? err.message : "Failed to submit declaration.");
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
  const occasionOptions = [
    "Business Meeting", "Festive Season", "Milestone", "Other", "Relationship Maintenance", "Year End",
  ];

  const valueNum = Number(form.value || 0);
  const requiresSubstantiation = Number.isFinite(valueNum) && valueNum > config.highValueThreshold;
  const requiresOccasionOther = form.occasion === "Other";

  const ErrInp = ({ field, ...props }: { field: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      {...props}
      className={`${inp} ${errors[field] ? "border-red-500 bg-red-50 focus:ring-4 focus:ring-red-500/20 focus:border-red-600 hover:border-red-400" : ""}`}
    />
  );

  return (
    <div className="flex items-start gap-3 max-w-none">
      {uploadError && (
        <div className="fixed top-5 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border border-amber-200 bg-white p-4 shadow-[0_18px_50px_rgba(79,29,149,0.18)]" style={F}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #F8D74A, #f59e0b)" }}>
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

      <aside className="w-48 flex-shrink-0 hidden lg:flex flex-col gap-3 sticky top-4 self-start">
        <Card className="p-3.5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2.5 px-1">
            Sections
          </p>
          <nav className="space-y-0.5">
            {FORM_SECTIONS.map((s) => {
              const active = activeSection === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => jumpTo(s.id)}
                  className={`w-full flex items-center gap-3 text-left py-2.5 px-3 rounded-xl text-sm transition-all duration-200 ${
                    active
                      ? "text-purple-900 font-semibold bg-purple-50 shadow-sm"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 font-medium"
                  }`}
                >
                  <span
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm transition-colors duration-200"
                    style={
                      active
                        ? { background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, color: "#fff" }
                        : { background: "#F0EEF8", color: "#6B6B80" }
                    }
                  >
                    {s.num}
                  </span>
                  <span className="leading-tight">{s.label}</span>
                </button>
              );
            })}
          </nav>
        </Card>

        <div className="rounded-2xl border border-white p-3.5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>
            Definitions
          </p>
          {[
            { t: "Gift",          d: "Anything of value including cash, vouchers, goods, services, preferential discounts or favours." },
            { t: "Hospitality",   d: "Accommodation, travel, conferences, tickets or formal business functions." },
            { t: "Entertainment", d: "Meals, events, sporting, cultural or recreational activities." },
          ].map((d) => (
            <div key={d.t} className="mb-2.5 last:mb-0">
              <p className="text-sm font-bold text-foreground">{d.t}</p>
              <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{d.d}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-white/60 p-3.5 bg-white/70 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.03)]">
          <p className="text-xs font-bold uppercase tracking-widest mb-2.5" style={{ color: PURPLE }}>
            Related Policies
          </p>
          {["Gifts, Hospitality & Entertainment Policy", "Anti-Bribery and Corruption Policy"].map((policy) => (
            <div key={policy} className="flex items-start gap-2 rounded-xl border border-primary/5 bg-secondary/20 p-2.5 mb-2 last:mb-0">
              <FileText size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
              <p className="text-xs font-semibold text-foreground leading-snug">{policy}</p>
            </div>
          ))}
        </div>
      </aside>

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
              <FL required error={errors.employeeName}>Team Member Name</FL>
              <ErrInp field="employeeName" value={form.employeeName} onChange={(e) => setF("employeeName", e.target.value)} />
            </div>
            <div>
              <FL error={errors.employeeCode}>Team Member Code</FL>
              <ErrInp field="employeeCode" value={form.employeeCode} onChange={(e) => setF("employeeCode", e.target.value)} placeholder="e.g. HB-204478" />
            </div>
            <div>
              <FL required error={errors.lineManager}>Manager Name</FL>
              <ErrInp field="lineManager" value={form.lineManager} onChange={(e) => setF("lineManager", e.target.value)} />
            </div>
            <div>
              <FL required error={errors.company}>Company</FL>
              <ErrInp field="company" value={form.company} onChange={(e) => setF("company", e.target.value)} />
            </div>
            <div>
              <FL required error={errors.department}>Department</FL>
              <ErrInp field="department" value={form.department} onChange={(e) => setF("department", e.target.value)} />
            </div>
            <div>
              <FL required error={errors.position}>Role / Position</FL>
              <ErrInp field="position" value={form.position} onChange={(e) => setF("position", e.target.value)} />
            </div>
          </div>
        </FS>

        <FS id="sec-declaration" num="2" title="Declaration Details">
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch">
              <div className="flex flex-col">
                <FL required>Did you receive or give a Gift, Hospitality or Entertainment?</FL>
                <div className="mt-auto">
                  <Sel value={receivedGiven} onChange={setReceivedGiven}>
                    <option>Received</option>
                    <option>Given</option>
                  </Sel>
                </div>
              </div>
              <div className="flex flex-col">
                <FL required error={errors.partyType}>
                  {receivedGiven === "Received" ? "Who did you receive it from?" : "Who did you give it to?"}
                </FL>
                <div className="mt-auto">
                  <Sel
                    value={form.partyType}
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
              <FL required hint="Full name of the organisation or individual." error={errors.Counterparty}>
                Name of the Supplier, Customer, Team Member or Public Official
              </FL>
              <input
                className={`${inp} ${errors.Counterparty ? "border-red-400" : ""}`}
                value={form.Counterparty}
                onChange={(e) => setF("Counterparty", e.target.value)}
                placeholder="Full legal name"
              />
            </div>
            <div>
              <FL required error={errors.contactPerson}>
                Name of the person giving or receiving the gift at the Supplier or Customer, or name of the Public Official
              </FL>
              <input
                className={`${inp} ${errors.contactPerson ? "border-red-400" : ""}`}
                value={form.contactPerson}
                onChange={(e) => setF("contactPerson", e.target.value)}
                placeholder="e.g. Ahmed Al-Rashid"
              />
            </div>
            <div className="space-y-5">
              <div>
                <FL required error={errors.contractNegotiation}>Are we currently negotiating a contract with the Supplier or Customer?</FL>
                <Sel value={form.contractNegotiation} onChange={(v) => setF("contractNegotiation", v)} className={errors.contractNegotiation ? "border-red-400" : ""}>
                  <option value="">Select…</option>
                  {ynu.map((o) => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.biddingProcess}>Is the Supplier or potential Supplier involved in a bidding process with us?</FL>
                <Sel value={form.biddingProcess} onChange={(v) => setF("biddingProcess", v)} className={errors.biddingProcess ? "border-red-400" : ""}>
                  <option value="">Select…</option>
                  {ynu.map((o) => <option key={o}>{o}</option>)}
                </Sel>
              </div>
              <div>
                <FL required error={errors.existingRelationship}>Is there an existing or imminent business relationship with the Supplier/Customer?</FL>
                <Sel value={form.existingRelationship} onChange={(v) => setF("existingRelationship", v)} className={errors.existingRelationship ? "border-red-400" : ""}>
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
              <FL required error={errors.category}>What category does the nature of the gift fall into?</FL>
              <Sel
                value={category}
                onChange={(v) => { setCategory(v); setErrors((e) => ({ ...e, category: "" })); }}
                className={errors.category ? "border-red-400" : ""}
              >
                <option value="">Select category…</option>
                <option>Gift</option>
                <option>Hospitality</option>
                <option>Entertainment</option>
              </Sel>
              {category && (
                <div className="mt-2.5 flex items-start gap-2.5 p-3.5 rounded-xl border border-primary/10" style={{ background: "#F5F2FF" }}>
                  <Check size={13} className="mt-0.5 flex-shrink-0" style={{ color: PURPLE }} />
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{category}:</span> {categoryDefs[category]}
                  </p>
                </div>
              )}
            </div>
            <div>
              <FL required error={errors.description}>Please describe the nature of the gift in detail</FL>
              <textarea
                className={`${inp} h-auto resize-none ${errors.description ? "border-red-400" : ""}`}
                rows={4}
                value={form.description}
                onChange={(e) => setF("description", e.target.value)}
                placeholder="e.g. Corporate dinner at Sandton Sun for 4 guests including wine and dessert. Estimated value R 4,200."
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              <div>
                <FL error={errors.occasionOther}>Reason/Occasion for the gift</FL>
                <Sel value={form.occasion} onChange={(v) => setF("occasion", v)}>
                  <option value="">Select reason…</option>
                  {occasionOptions.map((o) => <option key={o}>{o}</option>)}
                </Sel>
                {requiresOccasionOther && (
                  <input
                    className={`${inp} mt-3 ${errors.occasionOther ? "border-red-400" : ""}`}
                    value={form.occasionOther}
                    onChange={(e) => setF("occasionOther", e.target.value)}
                    placeholder="Please specify the reason"
                  />
                )}
              </div>
              <div className="self-start">
                <FL required error={errors.date}>Date of Gift</FL>
                <input
                  type="date"
                  className={`${inp} ${errors.date ? "border-red-400" : ""}`}
                  value={form.date}
                  onChange={(e) => setF("date", e.target.value)}
                />
              </div>
            </div>
            <div>
              <FL required error={errors.instances}>
                Number of instances a gift has been given/received between you and this party in the past 12 months
              </FL>
              <Sel value={form.instances} onChange={(v) => setF("instances", v)} className={errors.instances ? "border-red-400" : ""}>
                <option value="">Select…</option>
                {["0","1","2","3","4","5","6","7","8","9",">10"].map((n) => <option key={n}>{n}</option>)}
              </Sel>
            </div>
            <div>
              <FL hint="Enter the Rand value including VAT. Convert foreign currency to ZAR equivalent.">
                Rand Value or Equivalent Rand Value (including VAT)
              </FL>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">R</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={`${inp} pl-10`}
                  value={form.value ? formatRandValue(form.value, !isValueFocused) : ""}
                  onFocus={() => setIsValueFocused(true)}
                  onBlur={() => setIsValueFocused(false)}
                  onChange={(e) => setF("value", parseRandInput(e.target.value))}
                  placeholder="0.00"
                />
              </div>
            </div>
            {requiresSubstantiation && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-2.5 mb-3">
                <AlertCircle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">
                  If the Rand Value including VAT exceeds <strong>R2,000.00</strong>, please substantiate why this Gift, Hospitality or Entertainment should be accepted or given.
                </p>
              </div>
              <textarea
                className={`w-full h-20 rounded-xl px-4 py-3 text-sm border bg-white focus:outline-none focus:ring-2 transition-all resize-none placeholder:text-muted-foreground/50 ${
                  errors.substantiation ? "border-red-400 focus:ring-red-300/40" : "border-amber-200 focus:ring-amber-300/40"
                }`}
                value={form.substantiation}
                onChange={(e) => setF("substantiation", e.target.value)}
                placeholder="Substantiation for value exceeding R2,000.00 (if applicable)…"
              />
            </div>
            )}
          </div>
        </FS>

        <FS id="sec-docs" num="4" title="Supporting Documents">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
            className="sr-only"
            onChange={(e) => { processFiles(e.target.files); e.target.value = ""; }}
          />
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
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
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Paperclip size={13} style={{ color: PURPLE }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{f.name}</p>
                    <p className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <a href={f.url} download={f.name} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-primary" onClick={(e) => e.stopPropagation()}>
                    <Download size={13} />
                  </a>
                  <button
                    onClick={(e) => { e.stopPropagation(); setFiles((fs) => fs.filter((_, j) => j !== i)); }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-500"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Upload invoices, receipts, photos, or event invitations that support this declaration.
          </p>
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
            {submitError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            )}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
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
                style={{ background: `linear-gradient(135deg, ${PURPLE}, #6d28d9)`, border: "1px solid transparent", opacity: submitting ? 0.7 : 1 }}
              >
                <Send size={14} /> {submitting ? "Submitting..." : "Submit Declaration"}
              </button>
            </div>
          </div>
        </FS>
      </div>
    </div>
  );
}
