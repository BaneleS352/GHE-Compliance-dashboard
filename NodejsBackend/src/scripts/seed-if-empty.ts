/**
 * Seed an empty database only (`db:pg:up` helper).
 *
 * Counts users: if any exist the database is NOT empty and seeding is
 * skipped (seeding must never overwrite operational data). Otherwise it
 * dynamically imports `../seed`, whose module side effect runs the
 * idempotent seed (users, config, rules, dropdowns, reference data) and
 * then the normalization backfill.
 *
 * Exits 0 on successor skip, 1 on failure. Expects DATABASE_URL to already
 * point at the target database with a PostgreSQL-generated Prisma client.
 */
import "dotenv/config";
import { prisma } from "../config/prisma";

async function main() {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`Database not empty (${users} users) — skipping seed.`);
    return;
  }
  console.log("Empty database (0 users) — seeding...");
  await import("../seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
