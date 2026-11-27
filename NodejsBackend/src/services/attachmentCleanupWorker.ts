import { randomUUID } from "node:crypto";
import { prisma } from "../config/prisma";
import { deleteStoredAttachment } from "./attachmentStorage";

export interface ClaimedCleanup {
  id: bigint;
  storageReference: string;
  attemptCount: number;
}

const POLL_INTERVAL_MS = 5_000;
const BATCH_SIZE = 10;
const LOCK_TIMEOUT_MS = 15 * 60_000;
const MAX_RETRY_DELAY_MS = 6 * 60 * 60_000;
// Exhausted rows stay in PostgreSQL for reconciliation, but are no longer
// claimed automatically. This bounds storage retries without losing the
// opaque reference needed to remove a blob manually.
export const MAX_CLEANUP_ATTEMPTS = 5;

export async function claimAttachmentCleanupBatch(
  workerId: string,
  now = new Date(),
): Promise<ClaimedCleanup[]> {
  const lockedBefore = new Date(now.getTime() - LOCK_TIMEOUT_MS);
  return prisma.$transaction((tx) => tx.$queryRaw<ClaimedCleanup[]>`
    WITH candidates AS (
      SELECT "id"
      FROM public."AttachmentCleanupOutbox"
      WHERE (
        ("status" IN ('pending', 'retry') AND "nextAttemptAt" <= ${now} AND "attemptCount" < ${MAX_CLEANUP_ATTEMPTS}) OR
        ("status" = 'processing' AND "lockedAt" <= ${lockedBefore} AND "attemptCount" < ${MAX_CLEANUP_ATTEMPTS})
      )
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${BATCH_SIZE}
    )
    UPDATE public."AttachmentCleanupOutbox" AS cleanup
    SET "status" = 'processing',
        "attemptCount" = cleanup."attemptCount" + 1,
        "lockedAt" = ${now},
        "lockedBy" = ${workerId},
        "updatedAt" = ${now}
    FROM candidates
    WHERE cleanup."id" = candidates."id"
    RETURNING cleanup."id", cleanup."storageReference", cleanup."attemptCount"
  `);
}

async function completeCleanup(job: ClaimedCleanup, workerId: string): Promise<void> {
  const result = await prisma.attachmentCleanupOutbox.deleteMany({
    where: { id: job.id, status: "processing", lockedBy: workerId },
  });
  if (result.count !== 1) throw new Error("attachment_cleanup_claim_lost");
}

async function retryCleanup(job: ClaimedCleanup, workerId: string, error: unknown): Promise<boolean> {
  const candidate = error && typeof error === "object" && "code" in error
    ? error.code
    : error && typeof error === "object" && "name" in error ? error.name : "cleanup_failed";
  const errorCode = String(candidate).replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "cleanup_failed";
  const delay = Math.min(5_000 * (2 ** Math.min(job.attemptCount - 1, 16)), MAX_RETRY_DELAY_MS);
  const exhausted = job.attemptCount >= MAX_CLEANUP_ATTEMPTS;
  const result = await prisma.attachmentCleanupOutbox.updateMany({
    where: { id: job.id, status: "processing", lockedBy: workerId },
    data: {
      status: "retry",
      ...(exhausted ? {} : { nextAttemptAt: new Date(Date.now() + delay) }),
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: errorCode,
    },
  });
  if (result.count !== 1) throw new Error("attachment_cleanup_claim_lost");
  return exhausted;
}

export async function processAttachmentCleanup(
  job: ClaimedCleanup,
  workerId: string,
  removeBlob: (storageReference: string) => Promise<void> = deleteStoredAttachment,
): Promise<void> {
  try {
    await removeBlob(job.storageReference);
    await completeCleanup(job, workerId);
    console.info(JSON.stringify({
      event: "attachment_cleanup_succeeded",
      outboxId: String(job.id),
      attempt: job.attemptCount,
    }));
  } catch (error) {
    try {
      const exhausted = await retryCleanup(job, workerId, error);
      console.error(JSON.stringify({
        event: exhausted ? "attachment_cleanup_exhausted" : "attachment_cleanup_retry_scheduled",
        outboxId: String(job.id),
        attempt: job.attemptCount,
        errorName: safeErrorName(error),
      }));
    } catch (stateError) {
      console.error(JSON.stringify({
        event: "attachment_cleanup_state_update_failed",
        outboxId: String(job.id),
        errorName: safeErrorName(stateError),
      }));
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeErrorName(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 64) || "Error";
  }
  return "UnknownError";
}

export function startAttachmentCleanupWorker(): { stop: () => Promise<void> } {
  const workerId = randomUUID();
  let stopping = false;
  const loop = (async () => {
    console.info(JSON.stringify({ event: "attachment_cleanup_worker_started", workerId, pollIntervalMs: POLL_INTERVAL_MS }));
    while (!stopping) {
      try {
        const jobs = await claimAttachmentCleanupBatch(workerId);
        if (jobs.length === 0) {
          await wait(POLL_INTERVAL_MS);
          continue;
        }
        await Promise.all(jobs.map((job) => processAttachmentCleanup(job, workerId)));
      } catch (error) {
        console.error(JSON.stringify({ event: "attachment_cleanup_claim_failed", workerId, errorName: safeErrorName(error) }));
        await wait(POLL_INTERVAL_MS);
      }
    }
    console.info(JSON.stringify({ event: "attachment_cleanup_worker_stopped", workerId }));
  })();
  return {
    stop: async () => {
      stopping = true;
      await loop;
    },
  };
}
