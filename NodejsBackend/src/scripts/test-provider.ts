/**
 * Standalone throwaway OIDC provider for MANUAL API testing (never used in
 * production). Boots the same test JWKS server the automated harnesses use
 * and keeps it alive so a developer can mint bearer tokens with curl.
 *
 * Usage (two terminals):
 *   1. `npm run test:provider`
 *      # Test identity provider up at http://127.0.0.1:55439
 *   2. Start the API against it (migrated + seeded DATABASE_URL required):
 *      $env:OIDC_AUTHORITY="http://127.0.0.1:55439"
 *      $env:OIDC_ISSUER="http://127.0.0.1:55439"
 *      $env:OIDC_AUDIENCE="ghe-test-api-audience"
 *      $env:OIDC_CLIENT_ID="manual-testing"
 *      npm run dev
 *   3. Mint a token for a seeded local user (identity resolves by email):
 *      Invoke-RestMethod -Uri "http://127.0.0.1:55439/test-token" -Method Post `
 *        -Body '{"email":"admin@hb.co.za","name":"Admin User","oid":"manual-admin"}' `
 *        -ContentType "application/json"
 *   4. Call the API with `Authorization: Bearer <token>`.
 */
import { startTestJwksServer, TEST_JWKS_PORT } from "../test-utils/test-jwks-server";

async function main(): Promise<void> {
  const jwks = await startTestJwksServer();
  console.log(`Test identity provider up at ${jwks.baseUrl} (override port with TEST_JWKS_PORT, default ${TEST_JWKS_PORT}).`);
  console.log("Mint tokens with POST /test-token {email, name, oid}. Ctrl+C to stop.");

  const shutdown = () => {
    jwks.close().catch(() => undefined).finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
