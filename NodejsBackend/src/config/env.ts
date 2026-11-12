function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  port: (() => { const p = parseInt(process.env.PORT || "3001", 10); return Number.isFinite(p) ? p : 3001; })(),
  oidc: {
    authority: requireEnv("OIDC_AUTHORITY").replace(/\/$/, ""),
    audience: requireEnv("OIDC_AUDIENCE"),
    issuer: optionalEnv("OIDC_ISSUER", requireEnv("OIDC_AUTHORITY").replace(/\/$/, "")),
    allowedClientIds: requireEnv("OIDC_ALLOWED_CLIENT_IDS").split(",").map((id) => id.trim()).filter(Boolean),
    requiredScope: requireEnv("OIDC_REQUIRED_SCOPE"),
  },
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  staffProfile: {
    enabled: process.env.STAFF_PROFILE_SYNC_ENABLED === "true",
    endpoint: process.env.STAFF_API_ENDPOINT?.trim() || "",
    allowedHosts: (process.env.STAFF_API_ALLOWED_HOSTS?.trim() || "his-api-uat.betsolutions.net").split(",").map((host) => host.trim().toLowerCase()).filter(Boolean),
    token: process.env.AUTH_TOKEN?.trim() || "",
    tokenHeader: process.env.AUTH_TOKEN_HEADER?.trim() || "Authorization",
    tokenScheme: process.env.AUTH_TOKEN_SCHEME?.trim() ?? "Bearer",
    // Explicit HIS branch code -> local Organization.shortCode mapping.
    // Do not infer that similarly named identifiers represent the same org.
    branchOrganizationMap: (() => {
      const raw = process.env.STAFF_BRANCH_ORG_MAP?.trim();
      if (!raw) return {} as Record<string, string>;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key.trim().toUpperCase(), String(value).trim()]));
      } catch {
        throw new Error("STAFF_BRANCH_ORG_MAP must be a JSON object mapping HIS branch codes to organization short codes");
      }
    })(),
  },
};

// Re-exported here so production-posture checks have one import site; the
// implementations live in ./productionGuards (side-effect free, so seed.ts
// can use them without pulling in the OIDC requireEnv chain above).
export { docsEnabled, assertNonProductionSeed } from "./productionGuards";
