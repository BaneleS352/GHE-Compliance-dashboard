import { describe, it, expect } from "vitest";
import { PrismaClient } from "@prisma/client";
import { isDatabaseEmpty, readRootCounts } from "../scripts/seed-if-empty";

const prisma = new PrismaClient();

// The entrypoint auto-seeds on boot when the database looks empty, so the
// emptiness predicate is production-path logic: a partial wipe (zero users
// but leftover organizations/declarations) must NOT reseed, or the seed's
// explicit fixture ids collide with stale rows.
describe("seed-if-empty predicate", () => {
  it("treats all-zero counts as empty", () => {
    expect(isDatabaseEmpty({ users: 0, organizations: 0, declarations: 0 })).toBe(true);
  });

  it("treats users alone as non-empty", () => {
    expect(isDatabaseEmpty({ users: 1, organizations: 0, declarations: 0 })).toBe(false);
  });

  it("treats leftover organizations without users as non-empty (partial wipe)", () => {
    expect(isDatabaseEmpty({ users: 0, organizations: 2, declarations: 0 })).toBe(false);
  });

  it("treats leftover declarations without users as non-empty (failed seed)", () => {
    expect(isDatabaseEmpty({ users: 0, organizations: 0, declarations: 5 })).toBe(false);
  });

  it("reads live counts from the database", async () => {
    const counts = await readRootCounts(prisma);
    // Fixture database is populated; the predicate agrees it is not empty.
    expect(counts.users).toBeGreaterThan(0);
    expect(isDatabaseEmpty(counts)).toBe(false);
  });
});
