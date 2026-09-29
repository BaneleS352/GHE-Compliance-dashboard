import { backfillNormalization, formatBackfillReport } from "./backfill-normalization";
import { prisma } from "../config/prisma";

async function main() {
  const report = await backfillNormalization();
  console.log(formatBackfillReport(report));
  if (report.workflows.orphanInstances.length > 0) {
    console.warn(`orphan workflow instances: ${report.workflows.orphanInstances.join(", ")}`);
  }
  if (report.files.orphanFiles.length > 0) {
    console.warn(`orphan files: ${report.files.orphanFiles.join(", ")}`);
  }
  if (report.declarations.missingDeclarers.length > 0 || report.declarations.missingApprovers.length > 0) {
    console.warn(`missing user references: declarers=${report.declarations.missingDeclarers.length} approvers=${report.declarations.missingApprovers.length}`);
  }
  // Corrupt workflow JSON is skipped (never mirrored), so a success exit
  // would deploy green while serving degraded reads — fail loudly instead.
  if (report.workflows.corruptJson.length > 0) {
    console.error(`corrupt workflow JSON (not backfilled): ${report.workflows.corruptJson.join(", ")}`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
