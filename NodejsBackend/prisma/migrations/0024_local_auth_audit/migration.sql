CREATE TABLE "LocalAuthChallenge" (
  "id" TEXT NOT NULL,
  "userId" BIGINT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocalAuthChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalAuthChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LocalAuthChallenge_userId_expiresAt_idx" ON "LocalAuthChallenge"("userId", "expiresAt");

CREATE TABLE "LocalAuthEvent" (
  "id" BIGSERIAL NOT NULL,
  "userId" BIGINT,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LocalAuthEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LocalAuthEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "LocalAuthEvent_userId_createdAt_idx" ON "LocalAuthEvent"("userId", "createdAt");
