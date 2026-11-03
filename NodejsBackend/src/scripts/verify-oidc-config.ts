import fs from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

type Env = Record<string, string | undefined>;

const backendDir = process.cwd();
const repoDir = path.resolve(backendDir, "..");
const frontendDir = path.join(repoDir, "Enterprise Compliance Platform");
const modeArg = process.argv.find((arg) => arg.startsWith("--mode="));
const mode = modeArg?.slice("--mode=".length) || "development";
const errors: string[] = [];
let checks = 0;

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

const rootEnv = readEnvFile(path.join(repoDir, ".env"));
const backendFileEnv = readEnvFile(path.join(backendDir, ".env"));
const backendEnv: Env = { ...rootEnv, ...backendFileEnv, ...process.env };
const frontendEnvFiles = [
  `.env.${mode}.local`,
  ".env.local",
  `.env.${mode}`,
  ".env",
].map((file) => path.join(frontendDir, file));
const frontendEnv: Env = {
  ...rootEnv,
  ...mergeFiles(frontendEnvFiles),
  ...process.env,
};

function check(label: string, ok: boolean, detail: string): void {
  checks += 1;
  console.log(`${ok ? "[PASS]" : "[FAIL]"} ${label}: ${detail}`);
  if (!ok) errors.push(label);
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

async function main(): Promise<void> {
console.log(`OIDC configuration verification (mode: ${mode}; configured values are not printed)`);
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
  check("TLS certificate verification", false, "NODE_TLS_REJECT_UNAUTHORIZED=0 is set; remove it before verifying the provider");
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

if (spaClientId && allowedClientIds.length) {
  check("SPA client allowlist", allowedClientIds.includes(spaClientId), allowedClientIds.includes(spaClientId) ? "SPA client is allowed by the API" : "SPA client ID is not in OIDC_ALLOWED_CLIENT_IDS");
}
if (authority && frontendAuthority) {
  const matches = normalizedAuthority(authority.toString()) === normalizedAuthority(frontendAuthority.toString());
  check("Frontend/backend authority", matches, matches ? "both use the same tenant authority" : "frontend and API authorities differ");
}
if (apiScope && usable(backendEnv.OIDC_REQUIRED_SCOPE)) {
  const scopeName = apiScope.split("/").filter(Boolean).at(-1);
  check("Delegated scope", scopeName === backendEnv.OIDC_REQUIRED_SCOPE.trim(), scopeName === backendEnv.OIDC_REQUIRED_SCOPE.trim() ? "frontend requests the scope required by the API" : "frontend API scope and OIDC_REQUIRED_SCOPE differ");
}
if (apiScope && usable(backendEnv.OIDC_AUDIENCE)) {
  const apiResource = apiScope.slice(0, apiScope.lastIndexOf("/"));
  const defaultApiUri = apiResource.match(/^api:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i);
  if (defaultApiUri) {
    const audienceMatchesApi = backendEnv.OIDC_AUDIENCE.trim().toLowerCase() === defaultApiUri[1].toLowerCase();
    check("API audience", audienceMatchesApi, audienceMatchesApi ? "matches the API client ID for the expected v2 token" : "for Entra v2 tokens, set OIDC_AUDIENCE to the API client ID GUID, not the api:// scope URI");
  }
}

const redirect = frontendEnv.VITE_ENTRA_REDIRECT_URI?.trim();
if (redirect) parseUrl("VITE_ENTRA_REDIRECT_URI", redirect, true);
else console.log("[INFO] VITE_ENTRA_REDIRECT_URI: omitted; MSAL defaults to the frontend origin");

if (frontendEnv.VITE_ENTRA_CLIENT_SECRET || frontendEnv.VITE_CLIENT_SECRET) {
  check("SPA secret handling", false, "a client secret is set in frontend configuration; remove it (the SPA uses PKCE)");
}

if (authority && issuer && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
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
} else {
  console.log("[SKIP] OIDC discovery/JWKS: requires a valid authority, issuer, and TLS verification");
}

console.log(`\n${errors.length ? `${errors.length} of ${checks} checks need attention.` : `All ${checks} configuration/provider checks passed.`}`);
console.log("This check validates configuration consistency and public provider metadata; it does not prove app registration, consent, user provisioning, or an interactive SPA sign-in. Verify those by signing in through the SPA and confirming GET /api/auth/me succeeds.");
if (errors.length) process.exitCode = 1;
}

void main().catch(() => {
  console.error("OIDC configuration verification failed unexpectedly; details were suppressed.");
  process.exitCode = 1;
});
