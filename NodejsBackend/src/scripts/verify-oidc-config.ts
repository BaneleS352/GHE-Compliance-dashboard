import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { parse } from "dotenv";

type Env = Record<string, string | undefined>;

const backendDir = process.cwd();
const repoDir = path.resolve(backendDir, "..");
const frontendDir = path.join(repoDir, "Enterprise Compliance Platform");
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg?.slice("--mode=".length) || "development";
const appOriginArg = process.argv.find((arg) => arg.startsWith("--app-origin="));
const appOriginSetting = appOriginArg?.slice("--app-origin=".length);
const errors: string[] = [];
let checks = 0;
let skipped = 0;

function readEnvFile(file: string): Env {
  try {
    return parse(fs.readFileSync(file));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function mergeFiles(files: string[]): Env {
  const merged: Env = {};
  // Earlier files have lower precedence, matching dotenv/Vite file layering.
  for (const file of [...files].reverse()) Object.assign(merged, readEnvFile(file));
  return merged;
}

const backendFileEnv = readEnvFile(path.join(backendDir, ".env"));
// Match the actual service processes: backend dotenv loads NodejsBackend/.env;
// Vite loads files rooted in the frontend directory. Root .env is not implicitly
// loaded by either process, so do not let it make this verifier pass falsely.
const backendEnv: Env = { ...backendFileEnv, ...process.env };
const frontendEnvFiles = [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env",
].map((file) => path.join(frontendDir, file));
const frontendEnv: Env = {
  ...mergeFiles(frontendEnvFiles),
  ...process.env,
};

function check(label: string, ok: boolean, detail: string): void {
  checks += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}: ${detail}`);
  if (!ok) errors.push(label);
}

function skip(label: string, detail: string): void {
  skipped += 1;
  console.log(`[SKIP] ${label}: ${detail}`);
}

function info(label: string, detail: string): void {
  console.log(`[INFO] ${label}: ${detail}`);
}

function usable(value: string | undefined): value is string {
  return Boolean(value?.trim()) && !/<[^>]+>|replace[-_ ]?with|your[-_ ]/i.test(value!.trim());
}

function normalizedAuthority(value: string): string {
  return value.trim().replace(/\/$/, "").replace(/\/v2\.0$/i, "").toLowerCase();
}

function normalizedIssuer(value: string): string {
  return value.trim().replace(/\/$/, "").toLowerCase();
}

function parseUrl(label: string, value: string | undefined, allowLocalHttp: boolean): URL | null {
  if (!usable(value)) {
    check(label, false, "missing or still a placeholder");
    return null;
  }
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    const secureEnough = url.protocol === "https:" || (allowLocalHttp && local && url.protocol === "http:");
    check(label, secureEnough, secureEnough ? "valid URL" : "must use HTTPS (HTTP is allowed only for loopback test providers)");
    if (!secureEnough || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    check(label, false, "not a valid URL");
    return null;
  }
}

function errorFromAuthorizationResponse(url: URL | null, body: string): { error?: string; aadsts?: string } {
  const query = url?.searchParams;
  const error = query?.get("error") || body.match(/["']?error["']?\s*[:=]\s*["']?([a-zA-Z0-9_.-]+)/i)?.[1];
  const description = query?.get("error_description") || body;
  const aadsts = description.match(/\bAADSTS\d{5,}\b/i)?.[0]?.toUpperCase();
  return { ...(error ? { error: error.slice(0, 64).toLowerCase() } : {}), ...(aadsts ? { aadsts } : {}) };
}

function authorizationFailure(error: string | undefined, aadsts: string | undefined): string | null {
  if (aadsts === "AADSTS500011" || error === "invalid_resource") {
    return `Entra could not resolve the requested API resource in this tenant${aadsts ? ` (${aadsts})` : ""}; verify the API Application ID URI and tenant`;
  }
  if (aadsts === "AADSTS50011" || aadsts === "AADSTS500113") {
    return `the SPA redirect URI was rejected${aadsts ? ` (${aadsts})` : ""}; compare it with the SPA platform registration`;
  }
  if (aadsts === "AADSTS700016") {
    return `the SPA application was not found in this tenant (${aadsts}); verify VITE_ENTRA_CLIENT_ID and tenant`;
  }
  // prompt=none is expected to report a missing browser session from this
  // Node process. It does not prove token issuance or per-user consent.
  if (["login_required", "user_authentication_required"].includes(error || "") || aadsts === "AADSTS50058") return null;
  if (error === "consent_required" || error === "interaction_required") {
    return `Entra recognized the authorization request but requires user interaction or consent${aadsts ? ` (${aadsts})` : ""}`;
  }
  return error ? `Entra rejected the authorization request (${error}${aadsts ? `, ${aadsts}` : ""})` : null;
}

async function verifyAuthorizationRequest(authority: URL, clientId: string, redirectUri: string, apiScope: string): Promise<void> {
  const endpoint = new URL(`${normalizedAuthority(authority.toString())}/oauth2/v2.0/authorize`);
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  endpoint.search = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    response_mode: "query",
    redirect_uri: redirectUri,
    scope: `openid profile email ${apiScope}`,
    state: randomUUID(),
    nonce: randomUUID(),
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "none",
  }).toString();
  const fingerprint = createHash("sha256")
    .update([authority.toString(), clientId.trim().toLowerCase(), apiScope.trim(), new URL(redirectUri).toString()].join("\n"))
    .digest("hex")
    .slice(0, 16);
  console.log(`[INFO] SPA auth config fingerprint: ${fingerprint} (compare with the browser client-error log)`);

  try {
    // Do not follow the redirect or redeem any code. This is a silent,
    // noninteractive preflight to validate the SPA/resource/redirect request.
    const response = await fetch(endpoint, { redirect: "manual", signal: AbortSignal.timeout(15000) });
    const locationHeader = response.headers.get("location");
    let callback: URL | null = null;
    if (locationHeader) {
      try { callback = new URL(locationHeader); } catch { /* response is classified below */ }
    }
    let body = "";
    if (!locationHeader && response.status !== 204) body = (await response.text()).slice(0, 1024 * 1024);
    const { error, aadsts } = errorFromAuthorizationResponse(callback, body);
    const failure = authorizationFailure(error, aadsts);

    if (failure) {
      check("SPA authorization preflight", false, failure);
      return;
    }
    if (callback) {
      const expected = new URL(redirectUri);
      const returnedToSpa = callback.origin === expected.origin && callback.pathname === expected.pathname;
      const callbackHasExpectedSilentError = returnedToSpa && ["login_required", "user_authentication_required"].includes(error || "");
      if (callbackHasExpectedSilentError) {
        check("SPA authorization preflight", true, "Entra returned the expected no-session response for this client/scope/redirect request; consent and token issuance remain unverified");
        return;
      }
      if (returnedToSpa && callback.searchParams.has("code")) {
        check("SPA authorization preflight", true, "authorization request was accepted; returned code was not read or redeemed");
        return;
      }
      check("SPA authorization preflight", false, "Entra did not return an expected noninteractive response to the configured SPA redirect; response details were suppressed");
      return;
    }
    check("SPA authorization preflight", false, `unexpected authorization response (HTTP ${response.status}); response details were suppressed`);
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "request failed";
    check("SPA authorization preflight", false, `${detail}; provider error details were suppressed`);
  }
}

async function verifyExposeApiConfiguration(apiClientId: string, expectedResourceUri: string, expectedScope: string): Promise<void> {
  // App registration API configuration is not included in public OIDC
  // metadata. Read it from Microsoft Graph only when the caller explicitly
  // supplies a short-lived delegated token with Application.Read.All.
  const graphToken = process.env.ENTRA_GRAPH_ACCESS_TOKEN?.trim();
  if (!graphToken) {
    skip(
      "Entra Expose an API configuration",
      "set ENTRA_GRAPH_ACCESS_TOKEN to a short-lived Microsoft Graph token with Application.Read.All to verify the registered Application ID URI and enabled scope"
    );
    return;
  }

  try {
    const filter = encodeURIComponent(`appId eq '${apiClientId.replace(/'/g, "''")}'`);
    const graphUrl = `https://graph.microsoft.com/v1.0/applications?$filter=${filter}&$select=appId,identifierUris,api`;
    const response = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${graphToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      check(
        "Entra Expose an API inspection",
        false,
        response.status === 403 || response.status === 401
          ? "Microsoft Graph denied the lookup; use a token with Application.Read.All and required admin consent"
          : `Microsoft Graph lookup failed (HTTP ${response.status}); response details were suppressed`
      );
      return;
    }

    const result = await response.json() as {
      value?: Array<{
        appId?: string;
        identifierUris?: string[];
        api?: {
          oauth2PermissionScopes?: Array<{ value?: string; isEnabled?: boolean }>;
          requestedAccessTokenVersion?: number | null;
        };
      }>;
    };
    const application = result.value?.find((item) => item.appId?.toLowerCase() === apiClientId.toLowerCase());
    if (!application) {
      check("Entra API registration", false, "Microsoft Graph did not find an app registration matching OIDC_AUDIENCE");
      return;
    }

    const requestsV2Tokens = application.api?.requestedAccessTokenVersion === 2;
    check(
      "API access token version",
      requestsV2Tokens,
      requestsV2Tokens
        ? "API registration requests v2.0 access tokens"
        : "set the API registration access token version to 2; null or 1 issues v1.0 tokens whose issuer and audience do not match this API's v2 configuration"
    );

    const identifierMatches = application.identifierUris?.some(
      (uri) => uri.replace(/\/$/, "").toLowerCase() === expectedResourceUri.replace(/\/$/, "").toLowerCase()
    ) ?? false;
    check(
      "Expose an API Application ID URI",
      identifierMatches,
      identifierMatches
        ? "registered Application ID URI matches the resource requested by VITE_ENTRA_API_SCOPE"
        : "registered Application ID URI is missing or does not match the resource portion of VITE_ENTRA_API_SCOPE"
    );

    const enabledScope = application.api?.oauth2PermissionScopes?.some(
      (scope) => scope.value === expectedScope && scope.isEnabled === true
    ) ?? false;
    check(
      "Expose an API delegated scope",
      enabledScope,
      enabledScope
        ? "requested delegated scope exists and is enabled"
        : "requested delegated scope is missing or disabled under Expose an API"
    );
  } catch (error) {
    const detail = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "request failed";
    check("Entra Expose an API inspection", false, `${detail}; Graph error details were suppressed`);
  }
}

async function main(): Promise<void> {
console.log(`OIDC configuration verification (mode: ${mode}; configured values are not printed)`);
const tlsOverrideDetected = process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0";
if (tlsOverrideDetected) {
  check("TLS certificate verification", false, "NODE_TLS_REJECT_UNAUTHORIZED=0 is set; remove it from the app environment");
  // Preserve the failure above, but force strict certificate validation for
  // this verifier process so the remaining provider checks can still run.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";
  console.log("[INFO] Provider probes in this verifier force TLS certificate validation.");
}

const authority = parseUrl("OIDC_AUTHORITY", backendEnv.OIDC_AUTHORITY, true);
const issuerValue = backendEnv.OIDC_ISSUER?.trim() || backendEnv.OIDC_AUTHORITY?.trim();
const issuer = usable(issuerValue) ? issuerValue : undefined;
check("OIDC_ISSUER", Boolean(issuer), issuer ? "configured" : "missing or still a placeholder");
check("OIDC_AUDIENCE", usable(backendEnv.OIDC_AUDIENCE), usable(backendEnv.OIDC_AUDIENCE) ? "configured" : "missing or still a placeholder");

const allowedClientIds = (backendEnv.OIDC_ALLOWED_CLIENT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
check("OIDC_ALLOWED_CLIENT_IDS", allowedClientIds.length > 0 && allowedClientIds.every(usable), allowedClientIds.length ? "configured" : "missing or still a placeholder");
check("OIDC_REQUIRED_SCOPE", usable(backendEnv.OIDC_REQUIRED_SCOPE), usable(backendEnv.OIDC_REQUIRED_SCOPE) ? "configured" : "missing or still a placeholder");

const spaClientId = frontendEnv.VITE_ENTRA_CLIENT_ID?.trim();
const frontendAuthority = parseUrl("VITE_ENTRA_AUTHORITY", frontendEnv.VITE_ENTRA_AUTHORITY, true);
const apiScope = frontendEnv.VITE_ENTRA_API_SCOPE?.trim();
check("VITE_ENTRA_CLIENT_ID", usable(spaClientId), usable(spaClientId) ? "configured" : "missing or still a placeholder");
check("VITE_ENTRA_API_SCOPE", usable(apiScope), usable(apiScope) ? "configured" : "missing or still a placeholder");

let apiResource: string | undefined;
if (usable(apiScope)) {
  const scopeParts = apiScope.split("/");
  const scopeName = scopeParts.pop();
  apiResource = scopeParts.join("/");
  const validScopeName = Boolean(scopeName && /^[A-Za-z0-9._-]+$/.test(scopeName));
  const validResource = /^api:\/\/[^/\s?#]+$/i.test(apiResource) || /^https:\/\/[^\s?#]+$/i.test(apiResource);
  check(
    "API delegated scope format",
    validScopeName && validResource,
    validScopeName && validResource
      ? "fully qualified API scope has a valid resource URI and scope name"
      : "expected a scope such as api://<API-ID>/access_as_user or https://<API-host>/<scope>"
  );
}

if (spaClientId && allowedClientIds.length) {
  check("SPA client allowlist", allowedClientIds.includes(spaClientId), allowedClientIds.includes(spaClientId) ? "SPA client is allowed by the API" : "SPA client ID is not in OIDC_ALLOWED_CLIENT_IDS");
}
if (usable(spaClientId) && usable(backendEnv.OIDC_AUDIENCE)) {
  const distinctRegistrations = spaClientId.toLowerCase() !== backendEnv.OIDC_AUDIENCE.trim().toLowerCase();
  if (distinctRegistrations) {
    check("SPA/API registration split", true, "SPA client ID and API audience use separate app registrations");
  } else {
    info("Shared SPA/API registration", "one registration can serve both roles when it has the SPA redirect and exposes the requested API URI and scope; separate registrations are recommended for least privilege");
  }
}
if (authority && frontendAuthority) {
  const matches = normalizedAuthority(authority.toString()) === normalizedAuthority(frontendAuthority.toString());
  check("Frontend/backend authority", matches, matches ? "both use the same tenant authority" : "frontend and API authorities differ");
}
if (apiScope && usable(backendEnv.OIDC_REQUIRED_SCOPE)) {
  const scopeName = apiScope.split("/").filter(Boolean).at(-1);
  check("Delegated scope", scopeName === backendEnv.OIDC_REQUIRED_SCOPE.trim(), scopeName === backendEnv.OIDC_REQUIRED_SCOPE.trim() ? "frontend requests the scope required by the API" : "frontend API scope and OIDC_REQUIRED_SCOPE differ");
}
if (apiScope && apiResource && usable(backendEnv.OIDC_AUDIENCE)) {
  const defaultApiUri = apiResource.match(/^api:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (defaultApiUri) {
    const audienceMatchesApi = backendEnv.OIDC_AUDIENCE.trim().toLowerCase() === defaultApiUri[1].toLowerCase();
    check("API audience", audienceMatchesApi, audienceMatchesApi ? "matches the API client ID for the expected v2 token" : "for Entra v2 tokens, set OIDC_AUDIENCE to the API client ID GUID, not the api:// scope URI");
  } else if (apiResource) {
    info("API resource URI", "scope uses a custom Application ID URI; confirm it is configured under Expose an API on the API registration and that OIDC_AUDIENCE is that registration's client ID");
  }
}
if (apiScope && apiResource && usable(backendEnv.OIDC_AUDIENCE)) {
  const requiredScope = apiScope.split("/").filter(Boolean).at(-1);
  if (requiredScope) await verifyExposeApiConfiguration(backendEnv.OIDC_AUDIENCE.trim(), apiResource, requiredScope);
}

const redirectSetting = frontendEnv.VITE_ENTRA_REDIRECT_URI?.trim();
const redirectValue = redirectSetting || (mode === "development" ? "http://localhost:5173" : undefined);
const redirect = redirectValue ? parseUrl("VITE_ENTRA_REDIRECT_URI", redirectValue, true) : null;
if (!redirectValue) console.log("[INFO] VITE_ENTRA_REDIRECT_URI: omitted; the authorization preflight needs an explicit redirect URI outside development mode");
else if (!redirectSetting) console.log("[INFO] VITE_ENTRA_REDIRECT_URI: using the development SPA origin http://localhost:5173");
const appOriginValue = appOriginSetting || (mode === "development" ? "http://localhost:5173" : undefined);
const appOrigin = appOriginValue ? parseUrl("SPA app origin", appOriginValue, true) : null;
if (redirect && appOrigin) {
  const originMatches = redirect.origin === appOrigin.origin;
  check("SPA redirect origin", originMatches, originMatches ? "configured redirect uses the expected SPA origin" : "configured redirect origin differs from the running SPA origin; pass --app-origin with the actual browser origin or correct VITE_ENTRA_REDIRECT_URI");
} else if (!appOriginValue) {
  skip("SPA redirect origin", "set --app-origin to the deployed SPA origin outside development mode");
}

if (frontendEnv.VITE_ENTRA_CLIENT_SECRET || frontendEnv.VITE_CLIENT_SECRET) {
  check("SPA secret handling", false, "a client secret is set in frontend configuration; remove it (the SPA uses PKCE)");
}

if (authority && issuer) {
  const authorityBase = normalizedAuthority(authority.toString());
  const metadataUrl = `${authorityBase}/v2.0/.well-known/openid-configuration`;
  try {
    const response = await fetch(metadataUrl, { signal: AbortSignal.timeout(10000) });
    check("OIDC discovery endpoint", response.ok, response.ok ? "reachable over verified TLS" : `HTTP ${response.status}`);
    if (response.ok) {
      const metadata = await response.json() as { issuer?: string; jwks_uri?: string };
      const issuerMatches = typeof metadata.issuer === "string" && normalizedIssuer(metadata.issuer) === normalizedIssuer(issuer);
      check("Discovered issuer", issuerMatches, issuerMatches ? "matches OIDC_ISSUER" : "does not match OIDC_ISSUER");
      if (typeof metadata.jwks_uri === "string") {
        const jwksUrl = parseUrl("Discovered JWKS URL", metadata.jwks_uri, true);
        if (jwksUrl) {
          const jwksResponse = await fetch(jwksUrl, { signal: AbortSignal.timeout(10000) });
          check("JWKS endpoint", jwksResponse.ok, jwksResponse.ok ? "reachable over verified TLS" : `HTTP ${jwksResponse.status}`);
          if (jwksResponse.ok) {
            const jwks = await jwksResponse.json() as { keys?: unknown[] };
            check("Signing keys", Array.isArray(jwks.keys) && jwks.keys.length > 0, Array.isArray(jwks.keys) && jwks.keys.length > 0 ? "provider publishes signing keys" : "JWKS contains no keys");
          }
        }
      } else check("Discovered JWKS URL", false, "discovery metadata did not include jwks_uri");
    }
  } catch (error) {
    const label = error instanceof Error && error.name === "TimeoutError" ? "timed out" : "request failed";
    check("OIDC discovery/JWKS", false, `${label}; provider error details were suppressed`);
  }
  if (frontendAuthority && redirect && usable(spaClientId) && usable(apiScope)) {
    await verifyAuthorizationRequest(frontendAuthority, spaClientId, redirect.toString(), apiScope);
  } else {
    skip("SPA authorization preflight", "requires valid tenant authority, SPA client ID, API scope, and redirect URI");
  }
} else {
  skip("OIDC discovery/JWKS", "requires valid authority and issuer");
  skip("SPA authorization preflight", "requires valid authority and TLS verification");
}

console.log(`\n${errors.length ? `${errors.length} of ${checks} checks need attention.` : `All ${checks} configuration/provider checks passed.`}${skipped ? ` (${skipped} skipped)` : ""}`);
console.log("The preflight does not sign a user in or redeem a code. It checks Entra's noninteractive response for the configured client, API scope, and redirect; an expected login_required response does not prove token issuance or consent for an authenticated user. Verify consent and local user provisioning by signing in through the SPA and confirming GET /api/auth/me succeeds.");
if (errors.length) process.exitCode = 1;
}

void main().catch(() => {
  console.error("OIDC configuration verification failed unexpectedly; details were suppressed.");
  process.exitCode = 1;
});
