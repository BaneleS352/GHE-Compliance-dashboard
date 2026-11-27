import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { prisma } from "../config/prisma";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";
import { lockDeclarationRow } from "../services/normalization";
import { claimAttachmentCleanupBatch, processAttachmentCleanup } from "../services/attachmentCleanupWorker";
import {
  createAzuriteContainerClient,
  deleteStoredAttachment,
  readStoredAttachment,
} from "../services/attachmentStorage";

const app = buildApp();
const container = createAzuriteContainerClient();
const declarationIds: string[] = [];
const counterpartyNames: string[] = [];
const storageReferences: string[] = [];
const observedBlobNames: string[] = [];

interface DraftFixture {
  id: string;
  declarationPk: bigint;
}

interface FileFixture {
  id: bigint;
  storageReference: string;
}

interface RaceResponse {
  status: number;
  body: { error?: string };
}

type LifecycleKind = "submit" | "admin status" | "draft delete";

async function createDraft(): Promise<DraftFixture> {
  const counterparty = `P3-Evidence-Race-${randomUUID()}`;
  const created = await request(app)
    .post("/api/declarations")
    .set("Authorization", `Bearer ${getTeamToken()}`)
    .send({
      employee: "Nomvula Team", employeeId: 4, teamMemberNumber: "TM-001",
      lineManager: "Sipho Approver", position: "Brand Manager", department: "Marketing",
      type: "Gift", counterparty, value: 100, submitted: "2026-09-01",
      approver: "Sipho Approver", priority: "Low", description: "Evidence race fixture",
      relationship: "Test", receivedGiven: "Received", from: "Supplier", contactPerson: "T",
      biddingProcess: "No", occasion: "Business Meeting", date: "2026-09-01",
      instances: "1", publicOfficial: "No",
    });
  expect(created.status).toBe(201);
  const id = created.body.id as string;
  declarationIds.push(id);
  counterpartyNames.push(counterparty);
  const declaration = await prisma.declaration.findUniqueOrThrow({
    where: { id },
    select: { declarationPk: true },
  });
  return { id, declarationPk: declaration.declarationPk };
}

async function uploadEvidence(declarationId: string, filename: string, contents: string): Promise<FileFixture> {
  const uploaded = await request(app)
    .post("/api/files/upload")
    .set("Authorization", `Bearer ${getTeamToken()}`)
    .field("declarationId", declarationId)
    .attach("file", Buffer.from(contents), filename);
  expect(uploaded.status).toBe(201);
  const file = await prisma.uploadedFile.findUniqueOrThrow({
    where: { id: BigInt(uploaded.body.id as number) },
    select: { id: true, storageReference: true },
  });
  storageReferences.push(file.storageReference);
  return file;
}

function startLifecycleRequest(kind: LifecycleKind, declarationId: string) {
  if (kind === "submit") {
    return request(app)
      .patch(`/api/declarations/${declarationId}/submit`)
      .set("Authorization", `Bearer ${getTeamToken()}`);
  }
  if (kind === "admin status") {
    return request(app)
      .patch(`/api/declarations/${declarationId}/status`)
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .send({ status: "Escalated" });
  }
  return request(app)
    .delete(`/api/declarations/${declarationId}`)
    .set("Authorization", `Bearer ${getTeamToken()}`);
}

async function waitUntilBlockedCount(blockingPid: number, minimum: number): Promise<number> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const blocked = await prisma.$queryRaw<Array<{ pid: number }>>`
      SELECT activity.pid
      FROM pg_stat_activity AS activity
      WHERE activity.pid <> pg_backend_pid()
        AND ${blockingPid} = ANY(pg_blocking_pids(activity.pid))
    `;
    if (blocked.length >= minimum) return blocked.length;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return 0;
}

async function blobNames(): Promise<Set<string>> {
  const names = new Set<string>();
  for await (const blob of container.listBlobsFlat()) names.add(blob.name);
  return names;
}

afterEach(async () => {
  await prisma.attachmentCleanupOutbox.deleteMany({
    where: { storageReference: { in: storageReferences } },
  });
  await prisma.declaration.deleteMany({ where: { id: { in: declarationIds } } });
  await prisma.emailOutbox.deleteMany({ where: { declarationId: { in: declarationIds } } });
  await prisma.uploadedFile.deleteMany({ where: { storageReference: { in: storageReferences } } });
  await Promise.allSettled(storageReferences.splice(0).map((reference) => deleteStoredAttachment(reference)));
  await Promise.allSettled(observedBlobNames.splice(0).map((name) => container.getBlobClient(name).deleteIfExists()));
  await prisma.counterparty.deleteMany({ where: { name: { in: counterpartyNames } } });
  declarationIds.length = 0;
  counterpartyNames.length = 0;
});

describe("Phase 3 evidence/lifecycle races", () => {
  it.each(["submit", "admin status", "draft delete"] as const)(
    "rejects and rolls back an upload that loses a race to %s",
    async (kind) => {
      const draft = await createDraft();
      const filename = `p3-upload-${kind.replace(" ", "-")}-${randomUUID()}.txt`;
      const beforeBlobs = await blobNames();
      let lifecycleDone!: Promise<RaceResponse>;
      let uploadDone!: Promise<RaceResponse>;
      let newBlobNames: string[] = [];

      await prisma.$transaction(async (tx) => {
        expect(await lockDeclarationRow(tx, draft.declarationPk)).toBe(true);
        const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        lifecycleDone = startLifecycleRequest(kind, draft.id).then((response) => ({
          status: response.status,
          body: response.body as { error?: string },
        }));
        expect(await waitUntilBlockedCount(pid, 1)).toBeGreaterThanOrEqual(1);

        uploadDone = request(app)
          .post("/api/files/upload")
          .set("Authorization", `Bearer ${getTeamToken()}`)
          .field("declarationId", draft.id)
          .attach("file", Buffer.from("must be rolled back"), filename)
          .then((response) => ({
            status: response.status,
            body: response.body as { error?: string },
          }));
        const blobDeadline = Date.now() + 15_000;
        while (Date.now() < blobDeadline) {
          const currentBlobs = await blobNames();
          newBlobNames = [...currentBlobs].filter((name) => !beforeBlobs.has(name));
          if (newBlobNames.length > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        observedBlobNames.push(...newBlobNames);
        expect(newBlobNames).toHaveLength(1);
      }, { timeout: 30_000 });

      const [lifecycle, upload] = await Promise.all([lifecycleDone, uploadDone]);
      expect(lifecycle.status).toBe(200);
      expect(upload.status).toBe(kind === "draft delete" ? 404 : 400);
      expect(await prisma.uploadedFile.count({ where: { originalName: filename } })).toBe(0);
      const newReferences = newBlobNames.map((name) => `azurite:${name}`);
      expect(await prisma.attachmentCleanupOutbox.count({ where: { storageReference: { in: newReferences } } })).toBe(0);
      for (const name of newBlobNames) {
        expect(await container.getBlobClient(name).exists()).toBe(false);
      }

      const current = await prisma.declaration.findUnique({ where: { id: draft.id }, select: { status: true } });
      if (kind === "draft delete") expect(current).toBeNull();
      else expect(current?.status).toBe(kind === "submit" ? "Pending" : "Escalated");
    },
    45_000,
  );

  it.each(["submit", "admin status", "draft delete"] as const)(
    "does not let evidence deletion mutate a declaration after %s wins the row lock",
    async (kind) => {
      const draft = await createDraft();
      const contents = `evidence before ${kind}`;
      const file = await uploadEvidence(draft.id, `p3-delete-${kind.replace(" ", "-")}-${randomUUID()}.txt`, contents);
      let lifecycleDone!: Promise<RaceResponse>;
      let deleteDone!: Promise<RaceResponse>;

      await prisma.$transaction(async (tx) => {
        expect(await lockDeclarationRow(tx, draft.declarationPk)).toBe(true);
        const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        lifecycleDone = startLifecycleRequest(kind, draft.id).then((response) => ({
          status: response.status,
          body: response.body as { error?: string },
        }));
        expect(await waitUntilBlockedCount(pid, 1)).toBeGreaterThanOrEqual(1);
        deleteDone = request(app)
          .delete(`/api/files/${file.id}`)
          .set("Authorization", `Bearer ${getTeamToken()}`)
          .then((response) => ({
            status: response.status,
            body: response.body as { error?: string },
          }));
        // The lifecycle request queued first. Give the delete request time to
        // reach the same row lock, then release in FIFO order so lifecycle wins.
        await new Promise((resolve) => setTimeout(resolve, 500));
      }, { timeout: 30_000 });

      const [lifecycle, deletion] = await Promise.all([lifecycleDone, deleteDone]);
      expect(lifecycle.status).toBe(200);
      const current = await prisma.declaration.findUnique({ where: { id: draft.id }, select: { status: true } });

      if (kind === "draft delete") {
        expect(deletion.status).toBe(404);
        expect(current).toBeNull();
        expect(await prisma.uploadedFile.findUnique({ where: { id: file.id } })).toBeNull();
        expect(await prisma.declarationFile.count({ where: { fileId: file.id } })).toBe(0);
        const queued = await prisma.attachmentCleanupOutbox.findUniqueOrThrow({
          where: { storageReference: file.storageReference },
        });
        expect(queued).toMatchObject({ status: "pending", attemptCount: 0 });
        await expect(readStoredAttachment(file.storageReference)).resolves.toEqual(Buffer.from(contents));
        await prisma.attachmentCleanupOutbox.update({ where: { id: queued.id }, data: { nextAttemptAt: new Date(0) } });
        const workerId = randomUUID();
        const claimed = (await claimAttachmentCleanupBatch(workerId)).find((job) => job.id === queued.id);
        if (!claimed) throw new Error("Declaration-delete cleanup job was not claimed");
        await processAttachmentCleanup(claimed, workerId);
        await expect(readStoredAttachment(file.storageReference)).resolves.toBeNull();
        expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { id: queued.id } })).toBeNull();
        return;
      }

      expect(deletion.status).toBe(400);
      expect(deletion.body.error).toMatch(/locked during review/i);
      expect(current?.status).toBe(kind === "submit" ? "Pending" : "Escalated");
      expect(await prisma.uploadedFile.findUnique({ where: { id: file.id } })).not.toBeNull();
      expect(await prisma.declarationFile.count({ where: { fileId: file.id } })).toBe(1);
      await expect(readStoredAttachment(file.storageReference)).resolves.toEqual(Buffer.from(contents));
      expect(await prisma.attachmentCleanupOutbox.findUnique({ where: { storageReference: file.storageReference } })).toBeNull();
    },
    45_000,
  );
});
