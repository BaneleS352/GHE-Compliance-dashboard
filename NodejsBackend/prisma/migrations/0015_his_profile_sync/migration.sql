-- HIS-owned staff attributes are separate from local application access
-- controls. In particular, employmentStatus never changes User.isActive/role.
ALTER TABLE "User"
  ADD COLUMN "staffBranchCode" TEXT,
  ADD COLUMN "staffEmploymentStatus" TEXT,
  ADD COLUMN "staffEmploymentType" TEXT,
  ADD COLUMN "staffProfileSyncedAt" TIMESTAMP(3);
