-- Restore the User.lineManager display field if it was lost through local
-- schema drift. The authoritative manager relationship remains managerId.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lineManager" TEXT;
CREATE INDEX IF NOT EXISTS "User_lineManager_idx" ON "User"("lineManager");
