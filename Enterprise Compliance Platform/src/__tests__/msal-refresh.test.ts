import { describe, it, expect, vi, beforeEach } from "vitest";

// Real adapter under test; only the MSAL library is mocked.
const mocks = vi.hoisted(() => ({
  acquireTokenSilent: vi.fn(),
  acquireTokenRedirect: vi.fn(),
  getActiveAccount: vi.fn(),
  initialize: vi.fn(),
  loginRedirect: vi.fn(),
  logoutRedirect: vi.fn(),
  handleRedirectPromise: vi.fn(),
  getAllAccounts: vi.fn(() => []),
  setActiveAccount: vi.fn(),
}));

vi.mock("@azure/msal-browser", () => ({
  InteractionRequiredAuthError: class InteractionRequiredAuthError extends Error {
    constructor(message = "interaction_required") {
      super(message);
      this.name = "InteractionRequiredAuthError";
    }
  },
  PublicClientApplication: class {
    acquireTokenSilent = mocks.acquireTokenSilent;
    acquireTokenRedirect = mocks.acquireTokenRedirect;
    getActiveAccount = mocks.getActiveAccount;
    initialize = mocks.initialize;
    loginRedirect = mocks.loginRedirect;
    logoutRedirect = mocks.logoutRedirect;
    handleRedirectPromise = mocks.handleRedirectPromise;
    getAllAccounts = mocks.getAllAccounts;
    setActiveAccount = mocks.setActiveAccount;
  },
}));

import { getApiToken } from "../app/auth/msal";

describe("MSAL silent-acquisition recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    vi.stubEnv("VITE_ENTRA_CLIENT_ID", "test-client");
    vi.stubEnv("VITE_ENTRA_AUTHORITY", "https://login.microsoftonline.com/test-tenant/v2.0");
    vi.stubEnv("VITE_ENTRA_API_SCOPE", "api://test-client/access_as_user");
    mocks.getActiveAccount.mockReturnValue({ username: "a@b.c" });
  });

  it("returns the silent token when acquisition succeeds", async () => {
    mocks.acquireTokenSilent.mockResolvedValue({ accessToken: "silent-token" });
    await expect(getApiToken()).resolves.toBe("silent-token");
    expect(mocks.acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it("restarts interactive sign-in when silent acquisition requires interaction", async () => {
    const { InteractionRequiredAuthError } = await import("@azure/msal-browser");
    mocks.acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError("interaction_required", "interaction required"),
    );
    await expect(getApiToken()).rejects.toThrow(/redirecting to sign-in/i);
    expect(mocks.acquireTokenRedirect).toHaveBeenCalledTimes(1);
  });

  it("rethrows non-interaction failures without redirecting", async () => {
    mocks.acquireTokenSilent.mockRejectedValue(new Error("network down"));
    await expect(getApiToken()).rejects.toThrow("network down");
    expect(mocks.acquireTokenRedirect).not.toHaveBeenCalled();
  });
});