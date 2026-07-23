import { useState, useEffect } from "react";
import { ArrowLeft, Download, Eye, FileText } from "lucide-react";
import { Card } from "../components/ui/card";
import { formatRand } from "../../config/theme";
import { Declaration, UploadedFile } from "../../types/declaration";
import { fetchConfig } from "../../services/api";
import { motion } from "framer-motion";

export function DeclarationDetailView({
  data,
  onBack,
  hideBackButton,
  hideDocuments,
  hideTitle,
}: {
  data: Record<string, string> | Declaration;
  onBack: () => void;
  hideBackButton?: boolean;
  hideDocuments?: boolean;
  hideTitle?: boolean;
}) {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? (data as Declaration) : null;
  const record = !d ? (data as Record<string, string>) : null;
  const [config, setConfig] = useState({ highValueThreshold: 2000, mediumValueThreshold: 500, slaEscalationDays: 7, maxDeclarationsPerCounterparty: 10, emailTemplate: "" });

  useEffect(() => {
    fetchConfig().then(setConfig);
  }, []);

  const safe = (v: unknown) => (v != null ? String(v) : "—");

  const fields: [string, string][] = d
    ? [
        ["Team Member",            safe(d.employee)],
        ["Team Member Code",       safe(d.teamMemberNumber)],
        ["Manager",                safe(d.lineManager)],
        ["Company",                safe(d.company)],
        ["Department",             safe(d.department)],
        ["Position",               safe(d.position)],
        ["GHE Received/Given",     safe(d.receivedGiven)],
        ["Category",               safe(d.type)],
        ["Counter Party",     safe(d.Counterparty)],
        ["Counter Party Name",     safe(d.Counterparty)],
        ["Name Of Counter Person", safe(d.contactPerson)],
        ["Date",                   safe(d.date)],
        ["Value",                  formatRand(d.value)],
        ["Reason/Occasion",        safe(d.occasion)],
        ["Bid In Progress",        safe(d.biddingProcess)],
        ["Contract In Progress",   safe(d.contractNegotiation)],
        ["No. of GHE past 12 months", safe(d.instances)],
        ["Description",            safe(d.description)],
        ...(d.value > config.highValueThreshold
          ? ([[`Substantiation (> R${config.highValueThreshold})`, safe(d.substantiation || "Required")]] as [string, string][])
          : []),
      ]
    : [
        ["Team Member",            safe(record?.employee)],
        ["Team Member Code",       safe(record?.teamMemberNumber)],
        ["Manager",                safe(record?.lineManager)],
        ["Company",                safe(record?.company)],
        ["Department",             safe(record?.department)],
        ["Team",                   safe(record?.team)],
        ["Position",               safe(record?.position)],
        ["GHE Received/Given",     safe(record?.receivedGiven)],
        ["Category",               safe(record?.type)],
        ["Counter Party",     safe(record?.Counterparty)],
        ["Counter Party Name",     safe(record?.Counterparty)],
        ["Name Of Counter Person", safe(record?.contactPerson)],
        ["Date",                   safe(record?.date)],
        ["Value",                  safe(record?.value)],
        ["Reason/Occasion",        safe(record?.occasion)],
        ["Bid In Progress",        safe(record?.biddingProcess)],
        ["Contract In Progress",   safe(record?.contractNegotiation)],
        ["No. of GHE past 12 months", safe(record?.instances)],
        ["Description",            safe(record?.description)],
        ...(Number(record?.value) > config.highValueThreshold
          ? ([[`Substantiation (> R${config.highValueThreshold})`, safe(record?.substantiation || "Required")]] as [string, string][])
          : []),
      ];

  return (
    <div className="space-y-5">
      {!hideTitle && (
        <div className="flex items-center gap-3">
          {!hideBackButton && (
            <button
              onClick={onBack}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          <h1 className="text-xl font-bold">Declaration Details</h1>
        </div>
      )}
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
        {!hideTitle && (
          <h2 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-purple-50 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm">
            Declaration Details
          </h2>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map(([k, v]) => (
            <motion.div
              key={k}
              whileHover={{ scale: 1.015, y: -2 }}
              transition={{ duration: 0.2 }}
              className={`
                rounded-xl p-4
                bg-white
                border border-slate-200
                shadow-sm
                transition-all duration-200
                hover:border-purple-300 hover:shadow-md
                ${
                  ["Description", "Substantiation (> R2 000)"].includes(k)
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
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
    </div>

    {!hideDocuments && <SupportingDocuments data={data} />}
    </div>
  );
}

async function downloadFile(file: UploadedFile) {
  const response = await fetch(file.url);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function viewFile(file: UploadedFile) {
  const response = await fetch(file.url);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
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
        .map((file) => ({ name: file, size: 0, type: "", url: file }));
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
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-500 transition-all duration-200 hover:border-purple-300 hover:shadow-md">
                No supporting documents were uploaded for this declaration.
              </div>
            ) : (
              supportingDocuments.map((file, i) => (
                <motion.div
                  key={`${file.name}-${i}`}
                  whileHover={{ scale: 1.01, y: -2 }}
                  transition={{ duration: 0.2 }}
                  className="flex w-full flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-all duration-200 hover:border-purple-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
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
                </motion.div>
              ))
            )}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}
