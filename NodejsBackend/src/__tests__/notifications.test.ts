import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { config } from "../config/env";
import { notificationDedupeKey, queueNotification, queueNotificationSafely } from "../services/notificationService";
import { claimEmailBatch, deliverClaimedEmail, markEmailFailed } from "../services/emailOutboxWorker";

const prisma = new PrismaClient();
const testKeyPrefix = `email-test:${process.pid}:`;
const originalEmailDelivery = { ...config.emailDelivery };

beforeEach(async () => {
  Object.assign(config.emailDelivery, originalEmailDelivery, { enabled: true, smtpFrom: "ghe-tests@example.test" });
  await prisma.emailOutbox.deleteMany();
  await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: JSON.stringify({
    managerApproval: { subject: "Review [Declaration ID]", body: "Hi [Approving Manager Name], [Team Member Name] submitted [Declaration ID] [Manager Approval Option]." },
  }) } });
});

afterEach(async () => {
  await prisma.emailOutbox.deleteMany();
  await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: "{}" } });
  Object.assign(config.emailDelivery, originalEmailDelivery);
  vi.restoreAllMocks();
});

async function enqueueTestEmail(suffix: string) {
  const dedupeKey = `${testKeyPrefix}${suffix}`;
  await prisma.$transaction((tx) => queueNotification(tx, "managerApproval", "GHE-TEST-001", 2, dedupeKey, "accept"));
  return prisma.emailOutbox.findUniqueOrThrow({ where: { dedupeKey } });
}

describe("PostgreSQL email outbox notifications", () => {
  it("does not enqueue mail while delivery is disabled", async () => {
    config.emailDelivery.enabled = false;
    await prisma.$transaction((tx) => queueNotificationSafely(tx, "managerApproval", "GHE-TEST-001", 2, `${testKeyPrefix}disabled`));
    expect(await prisma.emailOutbox.count()).toBe(0);
  });

  it("renders the configured template and enqueues through the stored procedure idempotently", async () => {
    await prisma.systemConfig.update({
      where: { id: "default" },
      data: { notificationTemplates: JSON.stringify({
        managerApproval: {
          subject: "Review [Declaration ID]",
          body: "Hi [Approving Manager Name], [Team Member Name] submitted [Declaration ID] ([Manager Approval Option]).",
        },
      }) },
    });
    const dedupeKey = `${testKeyPrefix}idempotent`;
    const stableKey = notificationDedupeKey("managerApproval", "GHE-TEST-001", 91n, 2n);

    await prisma.$transaction(async (tx) => {
      await queueNotification(tx, "managerApproval", "GHE-TEST-001", 2, dedupeKey, "accept");
      await queueNotification(tx, "managerApproval", "GHE-TEST-001", 2, dedupeKey, "accept");
    });

    const [email, count] = await Promise.all([
      prisma.emailOutbox.findUniqueOrThrow({ where: { dedupeKey } }),
      prisma.emailOutbox.count({ where: { dedupeKey } }),
    ]);
    expect(stableKey).toMatch(/^[a-f0-9]{64}$/);
    expect(count).toBe(1);
    expect(email).toMatchObject({
      event: "managerApproval",
      declarationId: "GHE-TEST-001",
      recipientEmail: "sipho@test.com",
      subject: "Review GHE-TEST-001",
      status: "pending",
      attemptCount: 0,
    });
    expect(email.body).toContain("Sipho Approver");
    expect(email.body).toContain("accept");
  });

  it("does not abort a workflow transaction if the database procedure rejects a rendered message", async () => {
    await prisma.systemConfig.update({
      where: { id: "default" },
      data: { notificationTemplates: JSON.stringify({ managerApproval: { subject: "x".repeat(999), body: "Body" } }) },
    });
    const key = `${testKeyPrefix}invalid-template`;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await prisma.$transaction(async (tx) => {
      await queueNotificationSafely(tx, "managerApproval", "GHE-TEST-001", 2, key);
      return tx.approvalOption.count();
    });
    expect(result).toBeGreaterThan(0);
    expect(await prisma.emailOutbox.findUnique({ where: { dedupeKey: key } })).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('"event":"notification_enqueue_failed"'));
  });

  it("claims an outbox item once and records successful delivery without using a real SMTP server", async () => {
    const email = await enqueueTestEmail("success");
    const workerId = `worker:${process.pid}`;
    const [claimed] = await claimEmailBatch(workerId, 10);
    expect(claimed.id).toBe(email.id);
    expect(claimed.attemptCount).toBe(1);
    expect(await claimEmailBatch(`other:${process.pid}`, 10)).toEqual([]);

    const transport = {
      sendMail: vi.fn().mockResolvedValue({ messageId: "message-id-test" }),
    } as any;
    await deliverClaimedEmail(claimed, workerId, transport);

    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "sipho@test.com",
      subject: "Review GHE-TEST-001",
      text: expect.stringContaining("GHE-TEST-001"),
      disableFileAccess: true,
      disableUrlAccess: true,
    }));
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } })).resolves.toMatchObject({
      status: "sent",
      providerMessageId: "message-id-test",
      attemptCount: 1,
      lockedAt: null,
      lockedBy: null,
    });
  });

  it("records retry backoff and dead-letters after the bounded attempt count", async () => {
    const retryEmail = await enqueueTestEmail("retry");
    const workerId = `retry-worker:${process.pid}`;
    const now = new Date();
    const [claimed] = await claimEmailBatch(workerId, 10, now);
    await markEmailFailed(claimed, workerId, "ETIMEDOUT", now);
    const retryRow = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: retryEmail.id } });
    expect(retryRow.status).toBe("retry");
    expect(retryRow.lastErrorCode).toBe("ETIMEDOUT");
    expect(retryRow.nextAttemptAt.getTime()).toBe(now.getTime() + 30_000);

    await prisma.emailOutbox.update({ where: { id: retryEmail.id }, data: { attemptCount: 4, nextAttemptAt: now } });
    const [lastClaim] = await claimEmailBatch(workerId, 10, now);
    await markEmailFailed(lastClaim, workerId, "EAUTH", now);
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: retryEmail.id } })).resolves.toMatchObject({
      status: "failed",
      attemptCount: 5,
      lastErrorCode: "EAUTH",
      lockedAt: null,
      lockedBy: null,
    });
  });

  it("uses a deterministic key for the same event and workflow step", () => {
    expect(notificationDedupeKey("hrApproval", "GHE-TEST-001", 17n, 4n))
      .toBe(notificationDedupeKey("hrApproval", "GHE-TEST-001", 17n, 4n));
    expect(notificationDedupeKey("hrApproval", "GHE-TEST-001", 17n, 4n))
      .not.toBe(notificationDedupeKey("hrApproval", "GHE-TEST-001", 18n, 4n));
  });
});
