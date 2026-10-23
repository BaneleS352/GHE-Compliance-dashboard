import { describe, expect, it, vi } from "vitest";
import { reportClientError } from "../services/clientTelemetry";

describe("client telemetry", () => {
  it("emits safe normalized metadata without the original error object", () => {
    const listener = vi.fn();
    window.addEventListener("ghe:client-error", listener);

    const secret = new Error("backend response contained a secret");
    reportClientError(secret, { feature: "declaration", operation: "load" });

    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({
      feature: "declaration",
      operation: "load",
      name: "Error",
    });
    expect(event.detail).not.toHaveProperty("error");
    window.removeEventListener("ghe:client-error", listener);
  });

  it("normalizes non-Error failures to a safe generic value", () => {
    const listener = vi.fn();
    window.addEventListener("ghe:client-error", listener);

    reportClientError({ response: "sensitive body" }, { feature: "queue", operation: "refresh", status: 500 });

    const event = listener.mock.calls[0]?.[0] as CustomEvent;
    expect(event.detail).toEqual({
      feature: "queue",
      operation: "refresh",
      status: 500,
      name: "UnknownError",
    });
    expect(JSON.stringify(event.detail)).not.toContain("sensitive body");
    window.removeEventListener("ghe:client-error", listener);
  });
});
