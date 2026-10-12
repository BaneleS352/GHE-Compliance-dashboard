/**
 * Seed an empty database only (`db:pg:up` helper).
 *
 * A database counts as empty only when ALL root aggregates are absent
 * (users, organizations, declarations): "zero users" alone is not enough,
 * because a partial wipe or failed seed can leave declarations, snapshots,
 * or files behind, and reseeding would collide with the seed's explicit
 * fixture ids. Seeding must never overwrite operational data.
 *
 * Exits 0 on skip/success, 1 on failure. Expects DATABASE_URL to already
 * point at the target database with a PostgreSQL-generated Prisma client.
 */
import "dotenv/config";
import { prisma } from "../config/prisma";

export interface RootCounts {
  users: number;
  organizations: number;
  declarations: number;
}

/** Pure emptiness predicate: every root aggregate must be absent. */
export function isDatabaseEmpty(counts: RootCounts): boolean {
  return counts.users === 0 && counts.organizations === 0 && counts.declarations === 0;
}

export async function readRootCounts(client: {
  user: { count(): Promise<number> };
  organization: { count(): Promise<number> };
  declaration: { count(): Promise<number> };
}): Promise<RootCounts> {
  const [users, organizations, declarations] = await Promise.all([
    client.user.count(),
    client.organization.count(),
    client.declaration.count(),
  ]);
  return { users, organizations, declarations };
}

async function main() {
  const counts = await readRootCounts(prisma);
  if (!isDatabaseEmpty(counts)) {
    console.log(
      `Database not empty (users=${counts.users}, organizations=${counts.organizations}, declarations=${counts.declarations}) — skipping seed.`,
    );
    return;
  }
  console.log("Empty database (0 users, organizations, declarations) — seeding...");
  await import("../seed");
}

// Entry guard: tests import isDatabaseEmpty/readRootCounts without
// seeding (or disconnecting the shared client) as a side effect.
// Matches both the tsx source path and the compiled dist path used by
// entrypoint.sh (`node dist/scripts/seed-if-empty.js`).
const invokedDirectly =
  process.argv[1]?.endsWith("seed-if-empty.ts") === true ||
  process.argv[1]?.endsWith("seed-if-empty.js") === true;
if (invokedDirectly) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}