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

async function main() {
  const [users, organizations, declarations] = await Promise.all([
    prisma.user.count(),
    prisma.organization.count(),
    prisma.declaration.count(),
  ]);
  if (users > 0 || organizations > 0 || declarations > 0) {
    console.log(
      `Database not empty (users=${users}, organizations=${organizations}, declarations=${declarations}) — skipping seed.`,
    );
    return;
  }
  console.log("Empty database (0 users, organizations, declarations) — seeding...");
  await import("../seed");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
