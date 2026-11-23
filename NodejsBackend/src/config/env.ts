import { attachmentStorageConfig } from "./attachmentStorage";

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

function positiveIntegerEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

const emailDeliveryEnabled = process.env.EMAIL_DELIVERY_ENABLED === "true";
const emailApiUrl = process.env.EMAIL_API?.trim() || "";
const emailApiToken = process.env.EMAIL_API_TOKEN?.trim() || "";
const smtpHost = process.env.SMTP_HOST?.trim() || "";
const smtpFrom = process.env.SMTP_FROM?.trim() || "";
const smtpUser = process.env.SMTP_USER?.trim() || "";
const smtpPass = process.env.SMTP_PASS || "";
const smtpPort = positiveIntegerEnv("SMTP_PORT", 587);
const smtpSecure = process.env.SMTP_SECURE === "true";

if (emailDeliveryEnabled) {
  if (!emailApiUrl && (!smtpHost || !smtpFrom)) throw new Error("EMAIL_DELIVERY_ENABLED requires EMAIL_API or SMTP_HOST and SMTP_FROM");
  if (smtpSecure && smtpPort !== 465) console.warn("SMTP_SECURE=true is unusual outside implicit TLS port 465; verify the server settings.");
  if (Boolean(smtpUser) !== Boolean(smtpPass)) throw new Error("SMTP_USER and SMTP_PASS must either both be set or both be empty");
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("Refusing email delivery while NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS verification");
}

export const config = {
  localAuth: {
    enabled: process.env.LOCAL_AUTH_ENABLED === "true",
    // This must be explicitly enabled in development/test; production cannot
    // accidentally inherit a local credential path from a shared environment.
    issuer: process.env.LOCAL_AUTH_ISSUER?.trim() || "ghe-local",
    audience: "ghe-local-api",
    allowedClientId: "ghe-local-spa",
    requiredScope: "access_as_user",
  },
  port: (() => { const p = parseInt(process.env.PORT || "3001", 10); return Number.isFinite(p) ? p : 3001; })(),
  oidc: {
    authority: requireEnv("OIDC_AUTHORITY").replace(/\/$/, ""),
    audience: requireEnv("OIDC_AUDIENCE"),
    issuer: optionalEnv("OIDC_ISSUER", requireEnv("OIDC_AUTHORITY").replace(/\/$/, "")),
    allowedClientIds: requireEnv("OIDC_ALLOWED_CLIENT_IDS").split(",").map((id) => id.trim()).filter(Boolean),
    requiredScope: requireEnv("OIDC_REQUIRED_SCOPE"),
  },
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
  emailDelivery: {
    enabled: emailDeliveryEnabled,
    apiUrl: emailApiUrl,
    apiToken: emailApiToken,
    smtpHost,
    smtpPort,
    smtpSecure,
    smtpUser,
    smtpPass,
    smtpFrom,
    pollIntervalMs: positiveIntegerEnv("EMAIL_WORKER_POLL_INTERVAL_MS", 5000),
    batchSize: Math.min(positiveIntegerEnv("EMAIL_WORKER_BATCH_SIZE", 10), 20),
    lockTimeoutMs: positiveIntegerEnv("EMAIL_WORKER_LOCK_TIMEOUT_MS", 900000),
  },
  attachmentStorage: attachmentStorageConfig,
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

if (config.localAuth.enabled && process.env.NODE_ENV === "production") {
  throw new Error("LOCAL_AUTH_ENABLED must remain disabled in production");
}

// Re-exported here so production-posture checks have one import site; the
// implementations live in ./productionGuards (side-effect free, so seed.ts
// can use them without pulling in the OIDC requireEnv chain above).
export { docsEnabled, assertNonProductionSeed } from "./productionGuards";
