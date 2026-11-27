import { afterEach, describe, expect, it, vi } from "vitest";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { prisma } from "../config/prisma";
import { buildApp, getTeamToken } from "./helpers";
import {
  claimAttachmentCleanupBatch,
  MAX_CLEANUP_ATTEMPTS,
  processAttachmentCleanup,
} from "../services/attachmentCleanupWorker";
import {
  copyLegacyAttachmentToAzurite,
  deleteStoredAttachment,
  readStoredAttachment,
} from "../services/attachmentStorage";

const app = buildApp();
const createdIds: bigint[] = [];
const createdDeclarationIds: string[] = [];
const createdReferences: string[] = [];
const createdCounterparties: string[] = [];

interface UploadResponse {
  id: number;
}

async function createDraft(counterparty: string): Promise<string> {
  const created = await request(app)
    .post("/api/declarations")
    .set("Authorization", `Bearer ${getTeamToken()}`)
    .send({
      employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
      lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
      type: "Gift", counterparty, value: 50, submitted: "2026-07-05",
      approver: "Sipho Approver", priority: "Low", description: "Cleanup worker fixture",
      relationship: "Test", receivedGiven: "Received", from: "Supplier", contactPerson: "T",
      biddingProcess: "No", occasion: "Business Meeting", date: "2026-07-05",
      instances: "1", publicOfficial: "No",
    });
  expect(created.status).toBe(201);
  createdDeclarationIds.push(created.body.id);
  createdCounterparties.push(counterparty);
  return created.body.id as string;
}

async function uploadEvidence(declarationId: string, filename: string, contents: string) {
  const uploaded = await request(app)
    .post("/api/files/upload")
    .set("Authorization", `Bearer ${getTeamToken()}`)
    .field("declarationId", declarationId)
    .attach("file", Buffer.from(contents), filename);
  expect(uploaded.status).toBe(201);
  const body = uploaded.body as UploadResponse;
  const file = await prisma.uploadedFile.findUniqueOrThrow({
    where: { id: BigInt(body.id) },
    select: { id: true, storageReference: true },
  });
  createdReferences.push(file.storageReference);
  return file;
}

afterEach(async () => {
  await prisma.attachmentCleanupOutbox.deleteMany({
    where: { OR: [{ id: { in: createdIds } }, { storageReference: { in: createdReferences } }] },
  });
  await prisma.declaration.deleteMany({ where: { id: { in: createdDeclarationIds } } });
  await prisma.uploadedFile.deleteMany({ where: { storageReference: { in: createdReferences } } });
  await Promise.allSettled(createdReferences.splice(0).map((reference) => deleteStoredAttachment(reference)));
  await prisma.counterparty.deleteMany({ where: { name: { in: createdCounterparties } } });
  createdIds.length = 0;
  createdDeclarationIds.length = 0;
  createdCounterparties.length = 0;
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

  it("allows only one of two competing workers to claim the same job", async () => {
    const workerA = randomUUID();
    const workerB = randomUUID();
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const row = await prisma.attachmentCleanupOutbox.create({
      data: { storageReference, nextAttemptAt: new Date(0) },
    });
    createdIds.push(row.id);

    const [claimedA, claimedB] = await Promise.all([
      claimAttachmentCleanupBatch(workerA),
      claimAttachmentCleanupBatch(workerB),
    ]);
    const matches = [...claimedA, ...claimedB].filter((job) => job.id === row.id);

    expect(matches).toHaveLength(1);
    expect(matches[0].attemptCount).toBe(1);
    const persisted = await prisma.attachmentCleanupOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect([workerA, workerB]).toContain(persisted.lockedBy);
    expect(persisted.attemptCount).toBe(1);
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

  it.each(["file", "declaration"] as const)(
    "deletes a real Azurite blob after %s metadata deletion",
    async (target) => {
      const declarationId = await createDraft(`Cleanup-${target}-${randomUUID()}`);
      const contents = `real blob cleanup via ${target}`;
      const file = await uploadEvidence(declarationId, `${target}-cleanup.txt`, contents);
      await expect(readStoredAttachment(file.storageReference)).resolves.toEqual(Buffer.from(contents));

      const deleted = target === "file"
        ? await request(app).delete(`/api/files/${file.id}`).set("Authorization", `Bearer ${getTeamToken()}`)
        : await request(app).delete(`/api/declarations/${declarationId}`).set("Authorization", `Bearer ${getTeamToken()}`);
      expect(deleted.status).toBe(200);
      expect(await prisma.uploadedFile.findUnique({ where: { id: file.id } })).toBeNull();
      expect(await prisma.declarationFile.count({ where: { fileId: file.id } })).toBe(0);
      if (target === "declaration") {
        expect(await prisma.declaration.findUnique({ where: { id: declarationId } })).toBeNull();
      }

      const queued = await prisma.attachmentCleanupOutbox.findUniqueOrThrow({
        where: { storageReference: file.storageReference },
      });
      createdIds.push(queued.id);
      expect(queued).toMatchObject({ status: "pending", attemptCount: 0 });
      // Keep this fixture ahead of unrelated due jobs in the shared test DB.
      await prisma.attachmentCleanupOutbox.update({ where: { id: queued.id }, data: { nextAttemptAt: new Date(0) } });
      const workerId = randomUUID();
      const claimed = (await claimAttachmentCleanupBatch(workerId)).find((job) => job.id === queued.id);
      if (!claimed) throw new Error("Cleanup job was not claimed");
      await processAttachmentCleanup(claimed, workerId);

      await expect(readStoredAttachment(file.storageReference)).resolves.toBeNull();
      expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: queued.id } })).toBeNull();
    },
  );

  it("retries a simulated Azurite outage and deletes the real blob after recovery", async () => {
    const storageReference = await copyLegacyAttachmentToAzurite(Buffer.from("outage payload"), "text/plain");
    createdReferences.push(storageReference);
    const firstWorker = randomUUID();
    const row = await prisma.attachmentCleanupOutbox.create({
      data: { storageReference, status: "processing", attemptCount: 1, lockedAt: new Date(), lockedBy: firstWorker },
    });
    createdIds.push(row.id);
    const outage = Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" });

    await processAttachmentCleanup(
      { id: row.id, storageReference, attemptCount: 1 },
      firstWorker,
      async () => { throw outage; },
    );

    expect(await readStoredAttachment(storageReference)).not.toBeNull();
    expect(await prisma.attachmentCleanupOutbox.findUniqueOrThrow({ where: { id: row.id } })).toMatchObject({
      status: "retry",
      attemptCount: 1,
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: "ECONNREFUSED",
    });

    await prisma.attachmentCleanupOutbox.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(0) } });
    const recoveryWorker = randomUUID();
    const claimed = (await claimAttachmentCleanupBatch(recoveryWorker)).find((job) => job.id === row.id);
    if (!claimed) throw new Error("Retry job was not claimed after recovery");
    await processAttachmentCleanup(claimed, recoveryWorker);

    await expect(readStoredAttachment(storageReference)).resolves.toBeNull();
    expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: row.id } })).toBeNull();
  });

  it("stops automatic retries at the attempt limit and retains the job for reconciliation", async () => {
    const storageReference = `azurite:${randomBytes(16).toString("hex")}`;
    const row = await prisma.attachmentCleanupOutbox.create({
      data: {
        storageReference,
        status: "retry",
        attemptCount: MAX_CLEANUP_ATTEMPTS - 1,
        nextAttemptAt: new Date(0),
      },
    });
    createdIds.push(row.id);
    const workerId = randomUUID();
    const claimed = (await claimAttachmentCleanupBatch(workerId)).find((job) => job.id === row.id);
    if (!claimed) throw new Error("Final-attempt job was not claimed");
    expect(claimed.attemptCount).toBe(MAX_CLEANUP_ATTEMPTS);

    await processAttachmentCleanup(
      claimed,
      workerId,
      async () => { throw Object.assign(new Error("storage still unavailable"), { code: "ETIMEDOUT" }); },
    );

    const exhausted = await prisma.attachmentCleanupOutbox.findUniqueOrThrow({ where: { id: row.id } });
    expect(exhausted).toMatchObject({
      status: "retry",
      attemptCount: MAX_CLEANUP_ATTEMPTS,
      lockedAt: null,
      lockedBy: null,
      lastErrorCode: "ETIMEDOUT",
    });
    const laterClaims = await claimAttachmentCleanupBatch(randomUUID(), new Date(Date.now() + 24 * 60 * 60_000));
    expect(laterClaims.some((job) => job.id === row.id)).toBe(false);
  });
});
