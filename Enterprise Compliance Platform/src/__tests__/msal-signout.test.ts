import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ logoutRedirect: vi.fn() }));

vi.mock("@azure/msal-browser", () => ({
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {},
  PublicClientApplication: class {
    logoutRedirect = mocks.logoutRedirect;
  },
}));

describe("test-session sign-out", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("clears both local and injected tokens when both test modes are enabled", async () => {
    vi.stubEnv("VITE_ENABLE_LOCAL_AUTH", "true");
    vi.stubEnv("VITE_ENABLE_TEST_LOGIN", "false");
    sessionStorage.setItem("ghe.local.auth.token", "local-token");
    sessionStorage.setItem("e2e.auth.token", "injected-token");
    const { signOut } = await import("../app/auth/msal");

    signOut();

    expect(sessionStorage.getItem("ghe.local.auth.token")).toBeNull();
    expect(sessionStorage.getItem("e2e.auth.token")).toBeNull();
    expect(mocks.logoutRedirect).not.toHaveBeenCalled();
  });

  it("still clears an injected token when local employee auth is disabled", async () => {
    vi.stubEnv("VITE_ENABLE_LOCAL_AUTH", "false");
    vi.stubEnv("VITE_ENABLE_TEST_LOGIN", "false");
    sessionStorage.setItem("e2e.auth.token", "injected-token");
    const { signOut } = await import("../app/auth/msal");

    signOut();

    expect(sessionStorage.getItem("e2e.auth.token")).toBeNull();
    expect(mocks.logoutRedirect).not.toHaveBeenCalled();
  });
});
