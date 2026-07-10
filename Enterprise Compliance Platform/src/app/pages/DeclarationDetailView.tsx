import { Check, ArrowLeft, Download, Eye, FileText } from "lucide-react";
import { Card } from "../components/ui/card";
import { StatusBadge } from "../components/StatusBadge";
import { formatRand } from "../../config/theme";
import { Declaration, StatusType, UploadedFile } from "../../types/declaration";
import { motion } from "framer-motion";

export function DeclarationDetailView({
  data,
  onBack,
}: {
  data: Record<string, string> | Declaration;
  onBack: () => void;
}) {
  const isRecord = typeof (data as Declaration).value === "number";
  const d = isRecord ? (data as Declaration) : null;
  const record = !d ? (data as Record<string, string>) : null;

  const safe = (v: unknown) => (v != null ? String(v) : "—");

  const fields: [string, string][] = d
    ? [
        ["Team Member",            safe(d.employee)],
        ["Team Member Code",       safe(d.teamMemberNumber)],
        ["Manager",                safe(d.lineManager)],
        ["Company",                safe(d.company)],
        ["Department",             safe(d.department)],
        ["Position",               safe(d.position)],
        ["Received / Given",       safe(d.receivedGiven)],
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
        ...(d.value > 2000
          ? ([["Substantiation (> R2 000)", safe(d.substantiation || "Required")]] as [string, string][])
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
        ["Received / Given",       safe(record?.receivedGiven)],
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
        ...(Number(record?.value) > 2000
          ? ([["Substantiation (> R2 000)", safe(record?.substantiation || "Required")]] as [string, string][])
          : []),
      ];

  const status: StatusType = d ? d.status : "Pending";
  const sourceFiles = d?.files ?? record?.files ?? [];
  const supportingDocuments: UploadedFile[] = Array.isArray(sourceFiles)
    ? sourceFiles
    : String(sourceFiles)
        .split(",")
        .map((file) => file.trim())
        .filter(Boolean)
        .map((file) => ({ name: file, size: 0, type: "", url: file }));

  const downloadDocument = (file: UploadedFile) => {
    const link = document.createElement("a");
    link.href = file.url;
    link.download = file.name;
    link.click();
  };

  const workflowSteps = [
    {
      label: "Submission",
      actor: "Team Member",
      done: true,
      updates: [{ status: "Submitted", date: d ? d.submitted : new Date().toLocaleDateString("en-ZA"), time: "08:45" }],
    },
    {
      label: "Line Manager Review",
      actor: d ? d.lineManager : safe(record?.lineManager),
      done: status === "Approved" || status === "Declined",
      updates:
        status === "Approved"
          ? [{ status: "Approved", date: "2026-07-01", time: "10:15" }]
          : status === "Declined"
          ? [{ status: "Declined", date: "2026-07-01", time: "10:15" }]
          : [{ status: "Pending", date: "-", time: "-" }],
    },
    {
      label: "HR Review",
      actor: "Head of HR",
      done: status === "Approved",
      updates:
        status === "Approved"
          ? [{ status: "Approved", date: "2026-07-02", time: "12:30" }]
          : [{ status: "Pending", date: "-", time: "-" }],
    },
    {
      label: "CEO Approval",
      actor: "Group CEO",
      done: false,
      updates: [{ status: "Pending", date: "-", time: "-" }],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-200 hover:bg-purple-50 hover:text-purple-700 hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <h1 className="text-xl font-bold">Declaration Details</h1>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* ROW 1 */}
      <div className="xl:col-span-5 flex flex-col xl:flex-row gap-5">
        {/* Declaration fields */}
        <div className="flex-[3]">
          <div className="detail-panel-shell h-full">
          <Card
            className="
            detail-panel-card
            p-6 h-full rounded-2xl
            bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff]
            border border-white/40
            backdrop-blur-sm
            relative overflow-hidden
          "
        >
          {/* Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
          <div className="absolute bottom-0 right-0 opacity-20 pointer-events-none">
            <div className="w-32 h-32 bg-indigo-300 rounded-full blur-2xl" />
          </div>

          <div className="relative z-10">
            <h2 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-white/70 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm backdrop-blur-sm">
              Declaration Details
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fields.map(([k, v]) => (
                <motion.div
                  key={k}
                  whileHover={{ scale: 1.015, y: -2 }}
                  transition={{ duration: 0.2 }}
                  className={`
                    rounded-xl p-4
                    bg-white/70 backdrop-blur-sm
                    border border-white/60
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
        </div>

        {/* Approval workflow */}
        <div className="flex-[2]">
          <div className="detail-panel-shell h-full">
          <Card
            className="
              detail-panel-card
              p-6 h-full flex flex-col rounded-2xl
              bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff]
              border border-white/40
              backdrop-blur-sm
              relative overflow-hidden
            "
          >
            {/* Decorative glow */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />

            {/* Bottom decoration */}
            <div className="absolute bottom-0 right-0 opacity-20 pointer-events-none">
              <div className="w-32 h-32 bg-indigo-300 rounded-full blur-2xl" />
            </div>

            <div className="relative z-10 flex flex-col h-full">
              <h3 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-white/70 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm backdrop-blur-sm">
                Approval Workflow
              </h3>

              <div className="relative flex flex-col gap-6 flex-1">
                {/* Background line */}
                <div className="absolute left-4 top-2 bottom-2 w-[2px] bg-gray-300/60" />

                {/* Animated Progress line */}
                <motion.div
                  className="absolute left-4 top-2 w-[2px] bg-gradient-to-b from-emerald-500 to-emerald-400"
                  initial={{ height: 0 }}
                  animate={{
                    height: `${
                      ((workflowSteps.filter((s) => s.done).length - 1) /
                        (workflowSteps.length - 1 || 1)) *
                      100
                    }%`,
                  }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />

                {workflowSteps.map((step, i) => {
                  const isActive =
                    !step.done &&
                    workflowSteps.findIndex((s) => !s.done) === i;

                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      whileHover={{ scale: 1.01 }}
                      className="flex items-start gap-4 relative"
                    >
                      {/* Step Indicator */}
                      <div className="relative z-10">
                        <motion.div
                          whileHover={{ scale: 1.1 }}
                          className={`
                            w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold
                            transition-all
                            ${
                              step.done
                                ? "bg-emerald-500 text-white shadow"
                                : isActive
                                ? "bg-white border-2 border-emerald-500 text-emerald-600 shadow-[0_4px_20px_rgba(99,102,241,0.25)]"
                                : "bg-white/40 border border-white/50 text-gray-400"
                            }
                          `}
                        >
                          {step.done ? <Check size={14} /> : i + 1}
                        </motion.div>
                      </div>

                      {/* Step Content */}
                      <motion.div
                        layout
                        className={`
                          flex-1 rounded-xl border border-transparent p-4 transition-all duration-200
                          ${
                            isActive
                              ? "border-white/60 bg-white/70 shadow-sm hover:border-purple-300 hover:shadow-md"
                              : "hover:border-purple-300 hover:shadow-sm"
                          }
                        `}
                      >
                        <div className="flex items-center justify-between">
                          <p
                            className={`text-sm font-semibold ${
                              step.done
                                ? "text-gray-800"
                                : isActive
                                ? "text-indigo-700"
                                : "text-gray-400"
                            }`}
                          >
                            {step.label}
                          </p>

                          {step.done && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-emerald-100 text-emerald-600">
                              Completed
                            </span>
                          )}

                          {isActive && (
                            <span className="text-[10px] px-2 py-1 rounded-full bg-indigo-100 text-indigo-600">
                              In Progress
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 mb-3">
                          {step.actor}
                        </p>

                        {/* 👉 Current Action Panel */}
                        {isActive && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-3 rounded-lg border border-indigo-100 bg-indigo-50 p-3 text-xs transition-all duration-200 hover:border-purple-300 hover:shadow-sm"
                          >
                            Waiting for approval from{" "}
                            <b>{step.actor}</b>
                          </motion.div>
                        )}

                        {/* Updates */}
                        <div className="space-y-2">
                          {step.updates.map((u, idx) => (
                            <div
                              key={idx}
                              className="rounded-lg border border-white/60 bg-white/60 px-3 py-2 text-[11px] backdrop-blur-sm transition-all duration-200 hover:border-purple-300 hover:shadow-sm"
                            >
                              <div className="flex justify-between">
                                <span className="text-gray-500">Status</span>
                                <span className="font-medium">{u.status}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Date</span>
                                <span>{u.date}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-gray-500">Time</span>
                                <span>{u.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
        </Card>
        </div>
        </div>
        </div>

      {/* ROW 2 — Supporting Documents */}
      <div className="xl:col-span-3">
        <div className="detail-panel-shell">
        <Card
          className="
            detail-panel-card
            p-6 rounded-2xl
            bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff]
            border border-white/40
            backdrop-blur-sm
            relative overflow-hidden
          "
        >
          {/* Glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
          <div className="absolute bottom-0 right-0 opacity-20 pointer-events-none">
            <div className="w-32 h-32 bg-indigo-300 rounded-full blur-2xl" />
          </div>

          <div className="relative z-10">
            <h3 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-white/70 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm backdrop-blur-sm">
              Supporting Documents
            </h3>

            <div className="space-y-3">
              {supportingDocuments.length === 0 ? (
                <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-5 text-sm font-medium text-slate-500 transition-all duration-200 hover:border-purple-300 hover:shadow-md">
                  No supporting documents were uploaded for this declaration.
                </div>
              ) : (
                supportingDocuments.map((file, i) => (
                  <motion.div
                    key={`${file.name}-${i}`}
                    whileHover={{ scale: 1.01, y: -2 }}
                    transition={{ duration: 0.2 }}
                    className="flex w-full flex-col gap-3 rounded-xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur-sm transition-all duration-200 hover:border-purple-300 hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
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
                        onClick={() => window.open(file.url, "_blank", "noopener,noreferrer")}
                        className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-indigo-100 bg-white px-3 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-50 sm:flex-none"
                      >
                        <Eye size={13} /> View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDocument(file)}
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
      </div>
    </div>
  );
}
