CREATE TABLE "EmailOutbox" (
  "id" BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "event" TEXT NOT NULL CHECK ("event" IN (
    'managerApproval', 'hrApproval', 'declarationReturned',
    'declarationDeclined', 'declarationApproved'
  )),
  "declarationId" TEXT NOT NULL,
  "recipientEmail" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'processing', 'retry', 'sent', 'failed')),
  "attemptCount" INTEGER NOT NULL DEFAULT 0 CHECK ("attemptCount" >= 0),
  "maxAttempts" INTEGER NOT NULL DEFAULT 5 CHECK ("maxAttempts" BETWEEN 1 AND 10),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMPTZ(3),
  "lockedBy" TEXT,
  "sentAt" TIMESTAMPTZ(3),
  "providerMessageId" TEXT,
  "lastErrorCode" TEXT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailOutbox_recipient_email_check" CHECK (
    length("recipientEmail") <= 320 AND
    "recipientEmail" ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  CONSTRAINT "EmailOutbox_subject_length_check" CHECK (length("subject") BETWEEN 1 AND 998),
  CONSTRAINT "EmailOutbox_body_length_check" CHECK (length("body") BETWEEN 1 AND 100000),
  CONSTRAINT "EmailOutbox_dedupe_key_length_check" CHECK (length("dedupeKey") BETWEEN 1 AND 255),
  CONSTRAINT "EmailOutbox_declaration_id_length_check" CHECK (length("declarationId") BETWEEN 1 AND 100),
  CONSTRAINT "EmailOutbox_message_status_consistency_check" CHECK (
    ("status" = 'sent' AND "sentAt" IS NOT NULL) OR
    ("status" <> 'sent' AND "sentAt" IS NULL)
  )
);

CREATE INDEX "EmailOutbox_claim_idx"
  ON "EmailOutbox" ("status", "nextAttemptAt", "createdAt");

CREATE INDEX "EmailOutbox_created_at_idx"
  ON "EmailOutbox" ("createdAt");

CREATE OR REPLACE PROCEDURE public.enqueue_email_notification(
  IN p_event TEXT,
  IN p_declaration_id TEXT,
  IN p_recipient_email TEXT,
  IN p_subject TEXT,
  IN p_body TEXT,
  IN p_dedupe_key TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_event NOT IN (
    'managerApproval', 'hrApproval', 'declarationReturned',
    'declarationDeclined', 'declarationApproved'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_notification_event';
  END IF;

  IF p_declaration_id IS NULL OR length(p_declaration_id) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_declaration_id';
  END IF;
  IF p_recipient_email IS NULL OR length(p_recipient_email) > 320 OR
     p_recipient_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_recipient_email';
  END IF;
  IF p_subject IS NULL OR length(p_subject) NOT BETWEEN 1 AND 998 OR
     p_body IS NULL OR length(p_body) NOT BETWEEN 1 AND 100000 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_email_content';
  END IF;
  IF p_dedupe_key IS NULL OR length(p_dedupe_key) NOT BETWEEN 1 AND 255 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'invalid_idempotency_key';
  END IF;

  INSERT INTO public."EmailOutbox" (
    "event", "declarationId", "recipientEmail", "subject", "body", "dedupeKey"
  ) VALUES (
    p_event, p_declaration_id, lower(trim(p_recipient_email)), p_subject, p_body, p_dedupe_key
  ) ON CONFLICT ("dedupeKey") DO NOTHING;
END;
$$;
