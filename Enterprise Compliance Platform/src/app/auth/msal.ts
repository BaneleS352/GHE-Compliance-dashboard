import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo, type AuthenticationResult } from "@azure/msal-browser";

/** Enabled only for Vite dev or an explicit local Docker stub build. */
export const dockerStubAuthEnabled = import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";
export const testAuthEnabled = import.meta.env.DEV || dockerStubAuthEnabled;
/** Explicitly selects the local issuer for E2E or local test-provider runs. */
export const localTestProviderEnabled = import.meta.env.VITE_DEV_TEST_PROVIDER === "true";

/**
 * Single MSAL adapter (OpenID Phase 4): the only module that touches the
 * provider session. Components use `UserContext` and the shared HTTP
 * clients; nothing reads token storage directly.
 *
 * Configuration is resolved lazily so importing this module never crashes
 * (unit tests mock it; misconfigured production fails loudly at sign-in,
 * not at page load).
 *
 * E2E TEST HOOK (dev or explicit local Docker stub builds): when running with a
 * token injected at sessionStorage["e2e.auth.token"] (done by the
 * Playwright harness, which mints RS256 tokens from a throwaway local
 * provider), the adapter serves that token and reports a stub account
 * instead of contacting Entra. Ordinary production builds disable this branch,
 * while the explicit local Docker stub build enables it — verify with:
 * `grep -c "e2e.auth.token" dist/assets/*.js` (expect 0).
 * Quick login mints test tokens only through the separate local test provider;
 * normal production builds contain neither that UI nor its token hook.
 */
function e2eToken(): string | null {
  // Keep token storage behind testAuthEnabled so ordinary production builds
  // contain neither the key nor the lookup.
  if (testAuthEnabled) {
    try {
      return sessionStorage.getItem("e2e.auth.token");
    } catch {
      return null;
    }
  }
  return null;
}

interface EntraConfig {
  clientId: string;
  authority: string;
  redirectUri: string;
  apiScope: string;
}

function readConfig(): EntraConfig | null {
  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID as string | undefined;
  const authority = import.meta.env.VITE_ENTRA_AUTHORITY as string | undefined;
  const apiScope = import.meta.env.VITE_ENTRA_API_SCOPE as string | undefined;
  if (!clientId || !authority || !apiScope) return null;
  return {
    clientId,
    authority,
    redirectUri: (import.meta.env.VITE_ENTRA_REDIRECT_URI as string | undefined) || window.location.origin,
    apiScope,
  };
}

let client: PublicClientApplication | null = null;

class IdentityFlowError extends Error {
  readonly identityStage: string;
  readonly errorCode?: string;
  readonly errorCodes?: number[];
  readonly correlationId?: string;
  readonly subError?: string;
  readonly interactionRequired: boolean;
  readonly configFingerprint?: string;
  readonly requestedResourceMatch?: "matches_config" | "differs_from_config";

  constructor(stage: string, original: unknown, configFingerprint?: string, configuredResource?: string) {
    super("Identity provider operation failed");
    this.name = "IdentityFlowError";
    this.identityStage = stage;
    this.configFingerprint = configFingerprint;
    this.interactionRequired = original instanceof InteractionRequiredAuthError;
    if (original && typeof original === "object") {
      const source = original as { errorCode?: unknown; errorCodes?: unknown; correlationId?: unknown; subError?: unknown };
      if (typeof source.errorCode === "string") this.errorCode = source.errorCode;
      if (Array.isArray(source.errorCodes)) this.errorCodes = source.errorCodes.filter((value): value is number => typeof value === "number");
      if (typeof source.correlationId === "string") this.correlationId = source.correlationId;
      if (typeof source.subError === "string") this.subError = source.subError;
    }
    const providerMessage = original instanceof Error ? original.message : "";
    const aadstsCode = providerMessage.match(/\bAADSTS(\d{5,})\b/i)?.[1];
    if (aadstsCode) {
      const codes = this.errorCodes ?? [];
      this.errorCodes = [...new Set([...codes, Number(aadstsCode)])].slice(0, 5);
    }
    const failedResource = providerMessage.match(/resource principal named\s+['"]?([^\s'"]+)/i)?.[1]?.replace(/[.,;:]$/, "");
    if (failedResource && configuredResource) {
      this.requestedResourceMatch = failedResource.replace(/\/$/, "").toLowerCase() === configuredResource.replace(/\/$/, "").toLowerCase()
        ? "matches_config"
        : "differs_from_config";
    }
  }
}

async function runtimeConfigFingerprint(): Promise<string | undefined> {
  const config = readConfig();
  if (!config || !globalThis.crypto?.subtle) return undefined;
  try {
    const canonical = [
      new URL(config.authority).toString(),
      config.clientId.trim().toLowerCase(),
      config.apiScope.trim(),
      new URL(config.redirectUri).toString(),
    ].join("\n");
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(digest)).slice(0, 8).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

async function runIdentityStage<T>(stage: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    const config = readConfig();
    const configuredResource = config?.apiScope.slice(0, config.apiScope.lastIndexOf("/"));
    throw new IdentityFlowError(stage, error, await runtimeConfigFingerprint(), configuredResource);
  }
}

function getClient(): PublicClientApplication {
  if (!client) {
    const config = readConfig();
    if (!config) throw new Error("Missing Entra frontend configuration");
    client = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        authority: config.authority,
        redirectUri: config.redirectUri,
        postLogoutRedirectUri: config.redirectUri,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
  }
  return client;
}

function scopes(): string[] {
  const config = readConfig();
  const apiScope = config?.apiScope || "";
  return ["openid", "profile", "email", apiScope].filter(Boolean);
}

export const loginRequest = { get scopes() { return scopes(); } };

/** E2E stub account. Used only by development and explicit stub builds. */
function e2eStubAccount(): AccountInfo {
  return {
    homeAccountId: "e2e-home-account",
    environment: "e2e-test-provider",
    tenantId: "e2e-tenant",
    username: "e2e@test",
    localAccountId: "e2e-local-account",
    name: "E2E Test Identity",
  } as unknown as AccountInfo;
}

export async function initializeIdentity(): Promise<void> {
  if (dockerStubAuthEnabled || (import.meta.env.DEV && e2eToken())) return;
  // The local dev quick-login is a complete authentication path when no
  // Entra settings are supplied. Do not block the landing screen with an
  // MSAL configuration error before the developer can choose that path.
  if (import.meta.env.DEV && testAuthEnabled && !readConfig()) return;
  const app = getClient();
  await runIdentityStage("msal_initialize", () => app.initialize());
  const result = await runIdentityStage("msal_redirect_response", () => app.handleRedirectPromise());
  if (result?.account) app.setActiveAccount(result.account);
  if (!app.getActiveAccount()) {
    const accounts = app.getAllAccounts();
    // A sole cached account is unambiguous. Multiple cached identities must
    // go through Entra's explicit account chooser (loginRedirect below).
    if (accounts.length === 1) app.setActiveAccount(accounts[0]);
  }
}

export function activeAccount(): AccountInfo | null {
  if (testAuthEnabled && e2eToken()) return e2eStubAccount();
  if (dockerStubAuthEnabled) return null;
  // getClient() throws without configuration — callers treat that as
  // unauthenticated, same as having no account.
  try {
    return getClient().getActiveAccount();
  } catch {
    return null;
  }
}

export async function signIn(): Promise<AuthenticationResult | void> {
  if (dockerStubAuthEnabled || (import.meta.env.DEV && e2eToken())) return;
  const app = getClient();
  return app.loginRedirect({ scopes: scopes(), ...(app.getAllAccounts().length > 1 ? { prompt: "select_account" } : {}) });
}

export async function getApiToken(): Promise<string> {
  if (testAuthEnabled) {
    const injected = e2eToken();
    if (injected) return injected;
    if (dockerStubAuthEnabled) throw new Error("Sign in with a local test account first.");
  }
  const app = getClient();
  const account = app.getActiveAccount();
  if (!account) throw new Error("No authenticated Entra account");
  try {
    return (await runIdentityStage("msal_silent_token", () => app.acquireTokenSilent({ scopes: scopes(), account }))).accessToken;
  } catch (err) {
    // Expired token, password change, or Conditional Access challenge:
    // silent acquisition cannot proceed — restart interactive sign-in via
    // redirect. The redirect unloads the page, so callers see a rejection
    // for the in-flight request and must not retry it.
    if (err instanceof InteractionRequiredAuthError || (err instanceof IdentityFlowError && err.interactionRequired)) {
      await runIdentityStage("msal_token_redirect", () => app.acquireTokenRedirect({ scopes: scopes(), account }));
      throw new Error("Session refresh required — redirecting to sign-in.");
    }
    throw err;
  }
}

/** Acquire a separate delegated Microsoft Graph token for the signed-in user's profile. */
export async function getGraphAccessToken(): Promise<string | null> {
  // Local quick-login tokens are issued by the development test provider and
  // cannot be exchanged for a Microsoft Graph token.
  if (dockerStubAuthEnabled || (import.meta.env.DEV && e2eToken())) return null;
  const app = getClient();
  const account = app.getActiveAccount();
  if (!account) throw new Error("No authenticated Entra account");
  const graphRequest = { scopes: ["User.Read"], account };
  try {
    return (await runIdentityStage("msal_graph_profile_token", () => app.acquireTokenSilent(graphRequest))).accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError || (error instanceof IdentityFlowError && error.interactionRequired)) {
      await runIdentityStage("msal_graph_profile_consent", () => app.acquireTokenRedirect(graphRequest));
      throw new Error("Microsoft Graph consent is required — redirecting to sign-in.");
    }
    throw error;
  }
}

export function signOut(): void {
  if (dockerStubAuthEnabled || (import.meta.env.DEV && e2eToken())) {
    try {
      sessionStorage.removeItem("e2e.auth.token");
    } catch {
      // Storage unavailable — nothing to clear.
    }
    return;
  }
  void getClient().logoutRedirect();
}
