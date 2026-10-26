import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo, type AuthenticationResult } from "@azure/msal-browser";

/** Enabled only for Vite dev or an explicit local Docker stub build. */
export const dockerStubAuthEnabled = import.meta.env.VITE_ENABLE_TEST_LOGIN === "true";
export const testAuthEnabled = import.meta.env.DEV || dockerStubAuthEnabled;

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
  const app = getClient();
  await app.initialize();
  const result = await app.handleRedirectPromise();
  if (result?.account) app.setActiveAccount(result.account);
  if (!app.getActiveAccount()) {
    const account = app.getAllAccounts()[0];
    if (account) app.setActiveAccount(account);
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
  return getClient().loginRedirect({ scopes: scopes() });
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
    return (await app.acquireTokenSilent({ scopes: scopes(), account })).accessToken;
  } catch (err) {
    // Expired token, password change, or Conditional Access challenge:
    // silent acquisition cannot proceed — restart interactive sign-in via
    // redirect. The redirect unloads the page, so callers see a rejection
    // for the in-flight request and must not retry it.
    if (err instanceof InteractionRequiredAuthError) {
      await app.acquireTokenRedirect({ scopes: scopes(), account });
      throw new Error("Session refresh required — redirecting to sign-in.");
    }
    throw err;
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
