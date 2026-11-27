import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { prisma } from "../config/prisma";

const backendDir = process.cwd();
const tsxBin = resolve(backendDir, "node_modules/tsx/dist/cli.mjs");
const workers: ChildProcess[] = [];
let emailServer: Server;
let apiUrl: string;
let inbox: Array<{ receivedAt: string; message: { toEmail: string; emailSubject: string; emailBody: string } }> = [];
let responseStatuses: number[] = [];

async function createOutboxRow(overrides: { attemptCount?: number; maxAttempts?: number } = {}) {
  return prisma.emailOutbox.create({
    data: {
      event: "managerApproval",
      declarationId: "GHE-EMAIL-WORKER-TEST",
      recipientEmail: "worker-recipient@example.test",
      subject: "Controlled email worker delivery",
      body: "The worker should deliver this message through the local HTTP provider.",
      dedupeKey: `email-worker-integration:${randomUUID()}`,
      status: "pending",
      attemptCount: overrides.attemptCount ?? 0,
      maxAttempts: overrides.maxAttempts ?? 5,
      nextAttemptAt: new Date(0),
    },
  });
}

function startWorker(): ChildProcess {
  const child = spawn(process.execPath, [tsxBin, "src/scripts/email-worker.ts"], {
    cwd: backendDir,
    env: {
      ...process.env,
      NODE_ENV: "test",
      EMAIL_DELIVERY_ENABLED: "true",
      EMAIL_API: apiUrl,
      SMTP_FROM: "ghe-worker-tests@example.test",
      EMAIL_WORKER_POLL_INTERVAL_MS: "25",
      EMAIL_WORKER_BATCH_SIZE: "10",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  workers.push(child);
  child.stdout?.resume();
  child.stderr?.resume();
  return child;
}

async function stopWorker(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
  child.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((resolveTimeout) => setTimeout(resolveTimeout, 5000)),
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}

beforeEach(async () => {
  await prisma.emailOutbox.deleteMany();
  inbox = [];
  responseStatuses = [];
  emailServer = createServer((request, response) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => { body += chunk; });
    request.on("end", () => {
      const message = JSON.parse(body) as { toEmail: string; emailSubject: string; emailBody: string };
      inbox.push({ receivedAt: new Date().toISOString(), message });
      const status = responseStatuses.shift() ?? 200;
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify({ messageId: `local-provider-${inbox.length}` }));
    });
  });
  await new Promise<void>((resolveListening) => emailServer.listen(0, "127.0.0.1", resolveListening));
  const address = emailServer.address();
  if (!address || typeof address === "string") throw new Error("Email test server did not bind a TCP port");
  apiUrl = `http://127.0.0.1:${address.port}/send`;
});

afterEach(async () => {
  await Promise.all(workers.splice(0).map(stopWorker));
  await new Promise<void>((resolveClosed) => {
    emailServer.close(() => resolveClosed());
    emailServer.closeAllConnections();
  });
  await prisma.emailOutbox.deleteMany();
});

describe("email outbox worker process integration", () => {
  it("delivers a queued message through the real worker process", async () => {
    responseStatuses = [200];
    const email = await createOutboxRow();
    const worker = startWorker();

    await expect.poll(() => inbox.length, { timeout: 10_000 }).toBe(1);
    await expect.poll(async () => {
      const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
      return row.status;
    }, { timeout: 10_000 }).toBe("sent");

    expect(inbox[0].message).toMatchObject({
      toEmail: "worker-recipient@example.test",
      emailSubject: "Controlled email worker delivery",
    });
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } })).resolves.toMatchObject({
      status: "sent",
      attemptCount: 1,
      providerMessageId: "local-provider-1",
      lockedAt: null,
      lockedBy: null,
    });
    await stopWorker(worker);
  }, 20_000);

  it("retries a provider failure and succeeds after a worker restart", async () => {
    responseStatuses = [503, 200];
    const email = await createOutboxRow();
    const firstWorker = startWorker();

    await expect.poll(async () => {
      const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
      return row.status;
    }, { timeout: 10_000 }).toBe("retry");
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } })).resolves.toMatchObject({
      attemptCount: 1,
      lastErrorCode: "EMAIL_API_HTTP_503",
    });
    await stopWorker(firstWorker);

    await prisma.emailOutbox.update({
      where: { id: email.id },
      data: { nextAttemptAt: new Date() },
    });
    const restartedWorker = startWorker();
    await expect.poll(() => inbox.length, { timeout: 10_000 }).toBe(2);
    await expect.poll(async () => {
      const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
      return row.status;
    }, { timeout: 10_000 }).toBe("sent");
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } })).resolves.toMatchObject({
      attemptCount: 2,
      providerMessageId: "local-provider-2",
    });
    await stopWorker(restartedWorker);
  }, 25_000);

  it("dead-letters after the bounded provider attempt count", async () => {
    responseStatuses = [503];
    const email = await createOutboxRow({ attemptCount: 4, maxAttempts: 5 });
    const worker = startWorker();

    await expect.poll(async () => {
      const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } });
      return row.status;
    }, { timeout: 10_000 }).toBe("failed");
    await expect(prisma.emailOutbox.findUniqueOrThrow({ where: { id: email.id } })).resolves.toMatchObject({
      attemptCount: 5,
      lastErrorCode: "EMAIL_API_HTTP_503",
      lockedAt: null,
      lockedBy: null,
    });
    await stopWorker(worker);
  }, 20_000);
});
