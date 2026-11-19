CREATE TABLE public."AttachmentCleanupOutbox" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "storageReference" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ(3),
  "lockedBy" TEXT,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttachmentCleanupOutbox_reference_check"
    CHECK ("storageReference" ~ '^azurite:[a-f0-9]{32}$'),
  CONSTRAINT "AttachmentCleanupOutbox_status_check"
    CHECK ("status" IN ('pending', 'processing', 'retry')),
  CONSTRAINT "AttachmentCleanupOutbox_attempt_count_check"
    CHECK ("attemptCount" >= 0),
  CONSTRAINT "AttachmentCleanupOutbox_lock_consistency_check"
    CHECK (("lockedAt" IS NULL) = ("lockedBy" IS NULL))
);

CREATE INDEX "AttachmentCleanupOutbox_claim_idx"
  ON public."AttachmentCleanupOutbox" ("status", "nextAttemptAt", "createdAt");
