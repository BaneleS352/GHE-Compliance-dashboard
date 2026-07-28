const workflow = {
  steps: [
    { role: "lineManager", status: "approved", assigneeName: "LM1", assignee: "user-lm1" },
    { role: "hr", status: "approved", assigneeName: "HR1", assignee: "user-hr1" },
    { role: "ceo", status: "pending", assigneeName: "CEO1", assignee: "user-ceo1" },
  ]
};

console.log("Step processing logic:");
for (let i = 0; i < workflow.steps.length; i++) {
  const s = workflow.steps[i];
  const priorApproved = workflow.steps.slice(0, i).every((p) => p.status === "approved");
  console.log("Step " + i + ": role=" + s.role + ", status=" + s.status + ", assignee=" + s.assignee + ", priorApproved=" + priorApproved);
}

const activeStepIndex = workflow.steps.findIndex((s, i) => 
  s.status === "pending" && workflow.steps.slice(0, i).every((p) => p.status === "approved")
);
console.log("\nActive step would be:", activeStepIndex >= 0 ? workflow.steps[activeStepIndex].role : "none");