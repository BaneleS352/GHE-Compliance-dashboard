ALTER TABLE "User"
  ADD COLUMN "localAuthEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordEnrollmentRequired" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "phoneNumber" TEXT;

CREATE INDEX "User_localAuthEnabled_idx" ON "User"("localAuthEnabled");
