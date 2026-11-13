import { useState, useEffect } from "react";
import { Download, Eye, FileText, History, LoaderCircle } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { formatRand, DEFAULT_HIGH_VALUE_THRESHOLD, DEFAULT_MEDIUM_VALUE_THRESHOLD } from "@/config/theme";
import { Declaration, UploadedFile } from "@/types/declaration";
import { fetchDeclarationAudit, fetchPublicConfig } from "@/services/api";
import type { DeclarationAuditEvent } from "@/services/api";
import { downloadFile as downloadSharedFile, previewFile as previewSharedFile } from "@/services/download";
import { notifyError } from "@/app/components/notify";

export function DeclarationDetailView({
  data,
  hideDocuments,
}: {
  data: Record<string, string> | Declaration;
  hideDocuments?: boolean;
}) {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? (data as Declaration) : null;
  const record = !d ? (data as Record<string, string>) : null;
  const [config, setConfig] = useState({ highValueThreshold: DEFAULT_HIGH_VALUE_THRESHOLD, mediumValueThreshold: DEFAULT_MEDIUM_VALUE_THRESHOLD, slaEscalationDays: 7, maxDeclarationsPerCounterparty: 10, emailTemplate: "" });
  const [configWarning, setConfigWarning] = useState<string | null>(null);
  const [auditEvents, setAuditEvents] = useState<DeclarationAuditEvent[]>([]);
  const [auditState, setAuditState] = useState<"loading" | "loaded" | "error" | "unavailable">("unavailable");

  useEffect(() => {
    fetchPublicConfig()
      .then((publicConfig) => setConfig((current) => ({ ...current, ...publicConfig })))
      // Threshold labels depend on config — warn instead of silently
      // falling back to built-in defaults.
      .catch(() => setConfigWarning("System thresholds could not be loaded — default values are shown."));
  }, []);

  useEffect(() => {
    if (!d?.id) {
      setAuditState("unavailable");
      return;
    }
    let active = true;
    setAuditState("loading");
    fetchDeclarationAudit(d.id)
      .then((events) => {
        if (!active) return;
        setAuditEvents(events);
        setAuditState("loaded");
      })
      .catch(() => {
        if (active) setAuditState("error");
      });
    return () => { active = false; };
  }, [d?.id]);

  const safe = (v: unknown) => (v != null ? String(v) : "—");

  const fields: [string, string][] = d
    ? [
        ["Company",                safe(d.company)],
        ["Department",             safe(d.department)],
        ["Approving Manager Name", safe(d.lineManager)],
        ["Team Member",            safe(d.employee)],
        ["Team Member Code",       safe(d.teamMemberNumber)],
        ["Team Member Role / Position", safe(d.position)],
        ["GHE Received/Given",     safe(d.receivedGiven)],
        ["Category",               safe(d.type)],
        ["Counter Party Type",     safe(d.from)],
        ["Counter Party",     safe(d.counterparty)],
        // ["Counter Party Name",     safe(d.counterparty)],
        ["Name Of Counter Person", safe(d.contactPerson)],
        ["Date",                   safe(d.date)],
        ["Value",                  formatRand(d.value)],
        ["Reason/Occasion",        safe(d.occasion)],
        ["Bid In Progress",        safe(d.biddingProcess)],
        ["Contract In Progress",   safe(d.contractNegotiation)],
        ["Description",            safe(d.description)],
        ...(d.value >= config.highValueThreshold
          ? ([[`Substantiation (> R${config.highValueThreshold})`, safe(d.substantiation || "Required")]] as [string, string][])
          : []),
      ]
    : [
        ["Company",                safe(record?.company)],
        ["Department",             safe(record?.department)],
        ["Approving Manager Name", safe(record?.lineManager)],
        ["Team Member",            safe(record?.employee)],
        ["Team Member Code",       safe(record?.teamMemberNumber)],
        ["Team",                   safe(record?.team)],
        ["Team Member Role / Position", safe(record?.position)],
        ["GHE Received/Given",     safe(record?.receivedGiven)],
        ["Category",               safe(record?.type)],
        ["Counter Party Type",     safe(record?.from)],
        ["Counter Party",     safe(record?.counterparty)],
        // ["Counter Party Name",     safe(record?.counterparty)],
        ["Name Of Counter Person", safe(record?.contactPerson)],
        ["Date",                   safe(record?.date)],
        ["Value",                  safe(record?.value)],
        ["Reason/Occasion",        safe(record?.occasion)],
        ["Bid In Progress",        safe(record?.biddingProcess)],
        ["Contract In Progress",   safe(record?.contractNegotiation)],
        ["Description",            safe(record?.description)],
        ...(Number(record?.value) >= config.highValueThreshold
          ? ([[`Substantiation (> R${config.highValueThreshold})`, safe(record?.substantiation || "Required")]] as [string, string][])
          : []),
      ];

  return (
    <div className="h-full flex flex-col gap-5">
      {configWarning && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {configWarning}
        </div>
      )}
      <div className="detail-panel-shell flex-1 min-h-0">
      <Card
        className="
        detail-panel-card
        p-6 rounded-2xl
        bg-white
        border border-white/40
      "
    >

      <div className="relative z-10">
          <h2 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-purple-50 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm">
            Declaration Details
          </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(([k, v]) => (
            <div
              key={k}
              className={`
                rounded-xl p-4
                bg-white
                border border-slate-200
                shadow-sm
                ${
                  k === "Description" || k.startsWith("Substantiation")
                    ? "sm:col-span-2"
                    : ""
                }
              `}
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {k}
              </p>

              <p className="mt-2 text-sm font-medium text-slate-800 break-words">
                {v}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
    </div>

    {d?.id && <DeclarationHistory events={auditEvents} state={auditState} />}
    {!hideDocuments && <SupportingDocuments data={data} />}
    </div>
  );
}

function DeclarationHistory({ events, state }: { events: DeclarationAuditEvent[]; state: "loading" | "loaded" | "error" | "unavailable" }) {
  return (
    <div className="detail-panel-shell">
      <Card className="detail-panel-card p-6 rounded-2xl bg-white border border-white/40">
        <div className="relative z-10">
          <h3 className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-200/70 bg-purple-50 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm">
            <History size={15} aria-hidden="true" /> Change History
          </h3>
          {state === "loading" ? (
            <p role="status" className="flex items-center gap-2 text-sm text-slate-600"><LoaderCircle size={16} className="animate-spin" aria-hidden="true" />Loading declaration history…</p>
          ) : state === "error" ? (
            <p role="status" className="text-sm text-amber-800">Change history could not be loaded. Refresh the declaration to try again.</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-500">No recorded changes are available for this declaration.</p>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <p className="text-sm font-semibold text-slate-800">{auditActionLabel(event.action)}</p>
                    <time className="text-xs text-slate-500" dateTime={event.createdAt}>{formatAuditDate(event.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">By {event.actorName || "System"}</p>
                  {event.changedFields.length > 0 && <p className="mt-2 text-xs text-slate-600">Changed: {event.changedFields.join(", ")}</p>}
                  {(event.oldValues || event.newValues) && (
                    <details className="mt-2 text-xs text-slate-600">
                      <summary className="cursor-pointer font-semibold text-purple-800">View recorded values</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {event.oldValues && <ValueSnapshot label="Previous values" value={event.oldValues} />}
                        {event.newValues && <ValueSnapshot label="Updated values" value={event.newValues} />}
                      </div>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Card>
    </div>
  );
}

function ValueSnapshot({ label, value }: { label: string; value: Record<string, unknown> }) {
  return <div><p className="font-semibold">{label}</p><pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-2">{JSON.stringify(value, null, 2)}</pre></div>;
}

function auditActionLabel(action: string): string {
  const labels: Record<string, string> = {
    created: "Declaration created",
    updated: "Declaration updated",
    submitted: "Declaration submitted",
    workflow_decision: "Workflow decision recorded",
    status_overridden: "Status changed by an administrator",
    deleted: "Declaration deleted",
    file_uploaded: "Evidence uploaded",
    file_deleted: "Evidence deleted",
  };
  return labels[action] || "Declaration activity recorded";
}

function formatAuditDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function downloadFile(file: UploadedFile) {
  try {
    await downloadSharedFile(file.url, file.name);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : "Download failed. Please try again.");
  }
}

async function viewFile(file: UploadedFile) {
  try {
    await previewSharedFile(file.url);
  } catch (err) {
    notifyError(err instanceof Error ? err.message : "Preview failed. Please try again.");
  }
}

function parseFiles(data: Record<string, string> | Declaration): UploadedFile[] {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? (data as Declaration) : null;
  const record = !d ? (data as Record<string, string>) : null;
  const sourceFiles = d?.files ?? record?.files ?? [];
  return Array.isArray(sourceFiles)
    ? sourceFiles
    : String(sourceFiles)
        .split(",")
        .map((file) => file.trim())
        .filter(Boolean)
        .map((file) => ({ id: 0, name: file, size: 0, type: "", url: file }));
}

export function SupportingDocuments({ data }: { data: Record<string, string> | Declaration }) {
  const supportingDocuments = parseFiles(data);
  return (
    <div>
      <div className="detail-panel-shell">
      <Card
        className="
          detail-panel-card
          p-6 rounded-2xl
          bg-white
          border border-white/40
        "
      >

        <div className="relative z-10">
          <h3 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-purple-50 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm">
            Supporting Documents
          </h3>

          <div className="space-y-3">
            {supportingDocuments.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-500">
                No supporting documents were uploaded for this declaration.
              </div>
            ) : (
              supportingDocuments.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                        className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                      <p className="text-xs text-slate-500">
                        {file.size ? `${(file.size / 1024).toFixed(0)} KB` : "Uploaded document"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 sm:flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => viewFile(file)}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 sm:flex-none"
                    >
                      <Eye size={13} /> View
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadFile(file)}
                      className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 sm:flex-none"
                    >
                      <Download size={13} /> Download
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}
