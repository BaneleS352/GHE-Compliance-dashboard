import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { fetchWorkflowInstance } from "../../services/api";
import { Card } from "../components/ui/card";

export function WorkflowTimeline({ declarationId, employee }: { declarationId: string; employee?: string }) {
  const [workflowInstance, setWorkflowInstance] = useState<any>(undefined);

  useEffect(() => {
    fetchWorkflowInstance(declarationId).then(setWorkflowInstance);
  }, [declarationId]);

  const workflowSteps = (() => {
    if (workflowInstance && workflowInstance.steps.length > 0) {
      const steps = [
        {
          label: "Submission",
          actor: employee || "Team Member",
          done: true,
          updates: [{ status: "Submitted", date: "", time: "08:45" }],
        },
      ];
      for (const step of workflowInstance.steps) {
        const stepDone = step.status !== "pending";
        steps.push({
          label: step.label,
          actor: step.assigneeName,
          done: stepDone,
          updates: stepDone && step.decidedAt
            ? [{ status: step.status === "approved" ? "Approved" : step.status === "declined" ? "Declined" : "Returned", date: step.decidedAt.slice(0, 10), time: step.decidedAt.slice(11, 16) }]
            : [{ status: "Pending", date: "-", time: "-" }],
        });
      }
      return steps;
    }
    return [
      { label: "Submission", actor: employee || "Team Member", done: true, updates: [{ status: "Submitted", date: new Date().toLocaleDateString("en-ZA"), time: "08:45" }] },
      { label: "Line Manager Review", actor: "Loading...", done: false, updates: [{ status: "Pending", date: "-", time: "-" }] },
      { label: "HR Review", actor: "Head of HR", done: false, updates: [{ status: "Pending", date: "-", time: "-" }] },
      { label: "CEO Approval", actor: "Group CEO", done: false, updates: [{ status: "Pending", date: "-", time: "-" }] },
    ];
  })();

  return (
    <div className="detail-panel-shell h-full">
      <Card className="detail-panel-card p-6 h-full flex flex-col rounded-2xl bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#e0e7ff] border border-white/40 backdrop-blur-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />
        <div className="absolute bottom-0 right-0 opacity-20 pointer-events-none">
          <div className="w-32 h-32 bg-indigo-300 rounded-full blur-2xl" />
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <h3 className="mb-6 inline-flex rounded-full border border-purple-200/70 bg-white/70 px-4 py-1.5 text-sm font-extrabold uppercase tracking-[0.2em] text-purple-900 shadow-sm backdrop-blur-sm">
            Approval Workflow
          </h3>

          <div className="relative flex flex-col gap-6 flex-1">
            <div className="absolute left-4 top-2 bottom-2 w-[2px] bg-gray-300/60" />

            <motion.div
              className="absolute left-4 top-2 w-[2px] bg-gradient-to-b from-purple-600 to-purple-500"
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
              const isActive = !step.done && workflowSteps.findIndex((s) => !s.done) === i;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  whileHover={{ scale: 1.01 }}
                  className="flex items-start gap-4 relative"
                >
                  <div className="relative z-10">
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`w-8 h-8 flex items-center justify-center rounded-full text-xs font-semibold transition-all ${
                        step.done
                          ? "bg-purple-600 text-white shadow"
                          : isActive
                          ? "bg-white border-2 border-purple-600 text-purple-700 shadow-[0_4px_20px_rgba(124,58,237,0.25)]"
                          : "bg-white/40 border border-white/50 text-gray-400"
                      }`}
                    >
                      {i + 1}
                    </motion.div>
                  </div>

                  <motion.div
                    layout
                    className={`flex-1 rounded-xl border border-transparent p-4 transition-all duration-200 ${
                      isActive
                        ? "border-white/60 bg-white/70 shadow-sm hover:border-purple-300 hover:shadow-md"
                        : "hover:border-purple-300 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-semibold ${step.done ? "text-gray-800" : isActive ? "text-purple-700" : "text-gray-400"}`}>
                        {step.label}
                      </p>
                      {step.done && <span className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-600">✓ Completed</span>}
                      {isActive && <span className="text-[10px] px-2 py-1 rounded-full bg-purple-100 text-purple-700">In Progress</span>}
                      {!step.done && !isActive && <span className="text-[10px] px-2 py-1 rounded-full bg-gray-100 text-gray-500">Pending</span>}
                    </div>

                    <p className="text-xs text-gray-500 mb-3">{step.actor}</p>

                    {isActive && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3 rounded-lg border border-purple-100 bg-purple-50 p-3 text-xs transition-all duration-200 hover:border-purple-300 hover:shadow-sm"
                      >
                        Waiting for approval from <b>{step.actor}</b>
                      </motion.div>
                    )}

                    <div className="space-y-2">
                      {step.updates.map((u, idx) => (
                        <div key={idx} className="rounded-lg border border-white/60 bg-white/60 px-3 py-2 text-[11px] backdrop-blur-sm transition-all duration-200 hover:border-purple-300 hover:shadow-sm">
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
  );
}
