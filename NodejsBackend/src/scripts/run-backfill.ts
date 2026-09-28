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
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
