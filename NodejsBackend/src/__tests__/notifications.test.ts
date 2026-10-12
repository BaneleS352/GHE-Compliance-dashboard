import { describe, it, expect, vi, afterEach } from "vitest";
import { PrismaClient } from "@prisma/client";
import { sendNotification } from "../services/notificationService";

const prisma = new PrismaClient();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// The email webhook path previously had zero coverage: failures must never
// change workflow state (sendNotification never throws), missing templates
// or webhook config must no-op, and placeholders must render.
describe("notification webhook", () => {
  it("no-ops without a webhook configured and without throwing", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      sendNotification("managerApproval", "GHE-TEST-001", 2),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-ops for an unknown declaration", async () => {
    vi.stubEnv("EMAIL_WEBHOOK_URL", "");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(
      sendNotification("managerApproval", "GHE-NOPE-000", 2),
    ).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts rendered placeholders and resolves on success", async () => {
    const templates = {
      managerApproval: {
        subject: "Review [Declaration ID]",
        body: "Hi [Approving Manager Name], [Team Member Name] submitted [Declaration ID] with decision [Manager Approval Option].",
      },
    };
    await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: JSON.stringify(templates) } });
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://hooks.test/email");
    vi.stubEnv("EMAIL_WEBHOOK_TOKEN", "tok-123");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true, status: 200 } as any);
    try {
      await expect(
        sendNotification("managerApproval", "GHE-TEST-001", 2, "accept"),
      ).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0] as [string, any];
      expect(url).toBe("https://hooks.test/email");
      expect(options.headers.authorization).toBe("Bearer tok-123");
      const payload = JSON.parse(options.body);
      expect(payload.to).toBe("sipho@test.com");
      expect(payload.subject).toBe("Review GHE-TEST-001");
      expect(payload.body).toContain("GHE-TEST-001");
      expect(payload.body).toContain("accept");
    } finally {
      await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: "{}" } });
    }
  });

  it("never throws when delivery keeps failing", async () => {
    const templates = {
      managerApproval: { subject: "Review [Declaration ID]", body: "Body [Declaration ID]" },
    };
    await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: JSON.stringify(templates) } });
    vi.stubEnv("EMAIL_WEBHOOK_URL", "https://hooks.test/email");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false, status: 500 } as any);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(
        sendNotification("managerApproval", "GHE-TEST-001", 2),
      ).resolves.toBeUndefined();
      // 1 initial + retries (bounded, currently 3 attempts total).
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(fetchSpy.mock.calls.length).toBeLessThanOrEqual(3);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      await prisma.systemConfig.update({ where: { id: "default" }, data: { notificationTemplates: "{}" } });
    }
  });
});
