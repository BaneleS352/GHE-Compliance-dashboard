/**
 * Production posture guards (Phase 7). This module is intentionally free of
 * side effects: `seed.ts` imports it so seeding never requires unrelated
 * runtime configuration (e.g. OIDC variables) just to evaluate the guard.
 */

/**
 * Swagger/OpenAPI explorer posture: the interactive docs are a
 * development/diagnostic aid and must never be served from production.
 * Reads `NODE_ENV` at call time so tests can stub the environment.
 */
export function docsEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

/**
 * Production seed guard: seeding demo data must be a deliberate act, never
 * an accident of running `npm run db:seed` against the wrong
 * `DATABASE_URL`. Throws unless explicitly overridden with
 * `GHE_ALLOW_PROD_SEED=1`. `seed.ts` calls this before any database work.
 */
export function assertNonProductionSeed(): void {
  if (process.env.NODE_ENV === "production" && process.env.GHE_ALLOW_PROD_SEED !== "1") {
    throw new Error(
      "Refusing to seed: NODE_ENV=production. Set GHE_ALLOW_PROD_SEED=1 to override explicitly.",
    );
  }
}
