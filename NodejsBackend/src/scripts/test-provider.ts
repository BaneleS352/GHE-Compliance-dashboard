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
 *      $env:OIDC_ALLOWED_CLIENT_IDS="test-spa-client-id"
 *      $env:OIDC_REQUIRED_SCOPE="access_as_user"
 *      npm run dev
 *   3. In dev.bat/local test-seed mode, mint a token for a linked test user:
 *      Invoke-RestMethod -Uri "http://127.0.0.1:55439/test-token" -Method Post `
 *        -Body '{"email":"admin@hb.co.za","name":"Admin User","oid":"test-oid-e2e-admin@hb.co.za"}' `
 *        -ContentType "application/json"
 *      Email alone never links accounts; use the audited admin workflow for
 *      other local users.
 *   4. Call the API with `Authorization: Bearer <token>`.
 */
import { startTestJwksServer, TEST_JWKS_PORT } from "../test-utils/test-jwks-server";

async function main(): Promise<void> {
  const jwks = await startTestJwksServer();
  console.log(`Test identity provider up at ${jwks.baseUrl} (override port with TEST_JWKS_PORT, default ${TEST_JWKS_PORT}).`);
  console.log("Mint tokens with POST /test-token {email, name, oid}; oid must already be linked locally. Ctrl+C to stop.");

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
