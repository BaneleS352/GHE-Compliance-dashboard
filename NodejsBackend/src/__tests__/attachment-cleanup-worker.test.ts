import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../config/prisma";
import { claimAttachmentCleanupBatch, processAttachmentCleanup } from "../services/attachmentCleanupWorker";

const createdIds: bigint[] = [];

afterEach(async () => {
  if (createdIds.length === 0) return;
  await prisma.attachmentCleanupOutbox.deleteMany({ where: { id: { in: createdIds } } });
  createdIds.length = 0;
});

describe("Attachment cleanup worker", () => {
  it("claims due work and increments the attempt under the worker lease", async () => {
    const workerId = randomUUID();
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const row = await prisma.attachmentCleanupOutbox.create({
      data: { storageReference, nextAttemptAt: new Date(Date.now() - 1_000) },
    });
    createdIds.push(row.id);

    const claimed = await claimAttachmentCleanupBatch(workerId);

    expect(claimed).toContainEqual({ id: row.id, storageReference, attemptCount: 1 });
    expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: row.id } })).toMatchObject({
      status: "processing",
      attemptCount: 1,
      lockedBy: workerId,
    });
  });

  it("reclaims a stale processing lease after a worker disappears", async () => {
    const workerId = randomUUID();
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const now = new Date();
    const row = await prisma.attachmentCleanupOutbox.create({
      data: {
        storageReference,
        status: "processing",
        attemptCount: 2,
        lockedAt: new Date(now.getTime() - 16 * 60_000),
        lockedBy: randomUUID(),
      },
    });
    createdIds.push(row.id);

    const claimed = await claimAttachmentCleanupBatch(workerId, now);

    expect(claimed).toContainEqual({ id: row.id, storageReference, attemptCount: 3 });
    expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: row.id } })).toMatchObject({
      status: "processing",
      attemptCount: 3,
      lockedBy: workerId,
    });
  });

  it("removes a queued row after an idempotent blob deletion succeeds", async () => {
    const workerId = randomUUID();
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const row = await prisma.attachmentCleanupOutbox.create({
      data: { storageReference, status: "processing", attemptCount: 1, lockedAt: new Date(), lockedBy: workerId },
    });
    createdIds.push(row.id);
    const removeBlob = vi.fn(async () => undefined);

    await processAttachmentCleanup({ id: row.id, storageReference, attemptCount: 1 }, workerId, removeBlob);

    expect(removeBlob).toHaveBeenCalledWith(storageReference);
    expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: row.id } })).toBeNull();
  });

  it("keeps a failed delete queued with backoff and clears its claim", async () => {
    const workerId = randomUUID();
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const row = await prisma.attachmentCleanupOutbox.create({
      data: { storageReference, status: "processing", attemptCount: 1, lockedAt: new Date(), lockedBy: workerId },
    });
    createdIds.push(row.id);
    const failure = Object.assign(new Error("transient storage failure"), { code: "ETIMEDOUT" });

    await processAttachmentCleanup({ id: row.id, storageReference, attemptCount: 1 }, workerId, async () => { throw failure; });

    const retried = await prisma.attachmentCleanupOutbox.findUnique({ where: { id: row.id } });
    expect(retried).toMatchObject({ status: "retry", attemptCount: 1, lockedAt: null, lockedBy: null, lastErrorCode: "ETIMEDOUT" });
    expect(retried!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
  });
});
