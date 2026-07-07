import { Check } from "lucide-react";
import { Card } from "../components/ui/card";
import { StatusBadge } from "../components/";
import { formatRand } from "../config/theme";
import { Declaration, StatusType } from "../types/declaration";

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
    <div className="grid grid-cols-5 gap-5">
      {/* ROW 1 */}
      <div className="col-span-5 flex gap-5">
        {/* Declaration fields */}
        <div className="flex-[3]">
          <Card className="p-6 h-full">
            <h2 className="text-sm font-bold uppercase mb-4">Declaration Details</h2>
            <div className="grid grid-cols-2 gap-3">
              {fields.map(([k, v]) => (
                <div
                  key={k}
                  className={`rounded-xl p-3 bg-muted/30 border ${
                    ["Description", "Substantiation (> R2 000)"].includes(k) ? "col-span-2" : ""
                  }`}
                >
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">{k}</p>
                  <p className="text-sm font-medium mt-1">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Approval workflow */}
        <div className="flex-[2]">
          <Card className="p-6 h-full flex flex-col">
            <h3 className="text-sm font-bold uppercase mb-4">Approval Workflow</h3>
            <div className="relative flex flex-col justify-between flex-1">
              <div className="absolute left-[14px] top-7 bottom-7 w-[2px] bg-border" />
              <div
                className="absolute left-[14px] top-7 w-[2px] bg-emerald-600"
                style={{
                  height: `${
                    ((workflowSteps.filter((s) => s.done).length - 1) /
                      (workflowSteps.length - 1 || 1)) *
                    100
                  }%`,
                }}
              />
              {workflowSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center ${
                      step.done ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.done ? <Check size={12} /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{step.label}</p>
                    <p className="text-xs text-muted-foreground mb-2">{step.actor}</p>
                    {step.updates.map((u, idx) => (
                      <div key={idx} className="text-[11px] px-3 py-2 rounded-md bg-muted/40 border space-y-1">
                        <div className="flex gap-2"><span className="w-14 text-muted-foreground">Status:</span><span>{u.status}</span></div>
                        <div className="flex gap-2"><span className="w-14 text-muted-foreground">Date:</span><span>{u.date}</span></div>
                        <div className="flex gap-2"><span className="w-14 text-muted-foreground">Time:</span><span>{u.time}</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ROW 2 — Supporting Documents */}
      <div className="col-span-3">
        <Card className="p-6">
          <h3 className="text-sm font-bold uppercase mb-3">Supporting Documents</h3>
          <div className="space-y-2">
            {(record?.files ?? "")
              .split(",")
              .filter(Boolean)
              .map((file, i) => (
                <button
                  key={i}
                  className="w-full text-left text-sm px-3 py-2 rounded-lg border bg-muted/40 hover:bg-muted"
                  onClick={() => window.open(file.trim(), "_blank")}
                >
                  📄 {file.trim()}
                </button>
              ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
