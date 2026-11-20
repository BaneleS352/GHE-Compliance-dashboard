import { describe, expect, it } from "vitest";
import { createOtp, hashLocalPassword, verifyLocalPassword } from "../services/localAuth";

describe("local authentication crypto", () => {
  it("hashes passwords without storing the original value", async () => {
    const password = "LocalDevPassword!2026";
    const hash = await hashLocalPassword(password);
    expect(hash).not.toContain(password);
    expect(await verifyLocalPassword(password, hash)).toBe(true);
    expect(await verifyLocalPassword("wrong-password", hash)).toBe(false);
  });

  it("creates a six-digit OTP with a bounded expiry", () => {
    const before = Date.now();
    const otp = createOtp();
    expect(otp.code).toMatch(/^\d{6}$/);
    expect(otp.expiresAt.getTime()).toBeGreaterThan(before);
    expect(otp.expiresAt.getTime()).toBeLessThanOrEqual(before + 5 * 60 * 1000 + 1000);
  });
});
