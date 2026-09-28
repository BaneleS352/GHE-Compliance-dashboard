import { verifyNormalization, formatVerifyResult } from "./verify-normalization";
import { prisma } from "../config/prisma";

async function main() {
  const result = await verifyNormalization();
  console.log(formatVerifyResult(result));
  if (!result.ok) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
