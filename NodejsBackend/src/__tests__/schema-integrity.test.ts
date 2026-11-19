import { expect, it } from "vitest";
import { prisma } from "../config/prisma";

it("uses one database index for scoped counterparty uniqueness", async () => {
  const indexes = await prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'Counterparty'
    ORDER BY indexname
  `;
  const scopedUniqueIndexes = indexes.filter((index) =>
    /^CREATE UNIQUE INDEX/i.test(index.indexdef) && /\((?:"?name"?),\s*"organizationId"\)/i.test(index.indexdef),
  );

  expect(scopedUniqueIndexes, JSON.stringify(indexes)).toHaveLength(1);
  expect(scopedUniqueIndexes[0].indexname).toBe("Counterparty_name_organizationId_key");
});
