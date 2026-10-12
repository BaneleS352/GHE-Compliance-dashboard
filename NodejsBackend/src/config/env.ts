function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const config = {
  port: (() => { const p = parseInt(process.env.PORT || "3001", 10); return Number.isFinite(p) ? p : 3001; })(),
  oidc: {
    authority: requireEnv("OIDC_AUTHORITY").replace(/\/$/, ""),
    clientId: requireEnv("OIDC_CLIENT_ID"),
    audience: requireEnv("OIDC_AUDIENCE"),
    issuer: optionalEnv("OIDC_ISSUER", requireEnv("OIDC_AUTHORITY").replace(/\/$/, "")),
  },
  corsOrigin: process.env.CORS_ORIGIN || "http://localhost:5173",
};

// Re-exported here so production-posture checks have one import site; the
// implementations live in ./productionGuards (side-effect free, so seed.ts
// can use them without pulling in the OIDC requireEnv chain above).
export { docsEnabled, assertNonProductionSeed } from "./productionGuards";
