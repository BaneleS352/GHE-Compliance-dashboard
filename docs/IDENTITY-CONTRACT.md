# Identity and Authorization Contract (OpenID Phase 1)

This is the single written contract for identity and authorization. All
backend routes consume it through `authenticate`/`authorize` and the
normalized `AuthRequest.user`; no route parses tokens or provider claims.

## Provider identity

- Protocol: OpenID Connect against Microsoft Entra ID (Authorization Code
  + PKCE in the SPA; bearer access tokens at the API).
- Tenant/issuer: `OIDC_AUTHORITY` (JWKS at `<authority>/discovery/v2.0/keys`);
  `OIDC_ISSUER` defaults to the authority. Non-standard issuers override it
  explicitly — no silent fallback.
- Audience: `OIDC_AUDIENCE`. Tokens for any other audience are rejected.
- Subject: the Entra object ID (`oid` claim). Email comes from
  `preferred_username`, falling back to `email`. Display name falls back to
  the email address.
- Raw provider claims never reach domain services. The middleware maps them
  to `AuthRequest.user` and drops everything else.

## Application identity

- The Prisma `User` row is authoritative for id, name, email, role,
  organization, department, manager, and workflow permissions.
- Provider linkage: `User.providerSubject` (globally unique) plus
  `User.providerIssuer`. No mutable display name is ever used for correlation.

## Resolution algorithm (`middleware/auth.ts`)

1. Validate the bearer token: RS256 signature via JWKS, exact issuer,
   exact audience, lifetime. Anything else → `401`.
2. Require a string `oid` and a non-empty email → else `401`.
3. Look up the local user **by email**. Unknown email → `403`
   (default-deny: no auto-provisioning in this compliance system).
4. If the row has no linked subject, adopt the token subject (first login).
5. If the row has a linked subject different from the token subject,
   reject with `403` (fail closed on account mismatch — never re-link).
6. Populate `AuthRequest.user` (numeric id, role, display fields) from the
   row. Local role changes apply on the next request; tokens carry no role.

## Role ownership

Local database roles remain authoritative. Frontend route guards are UX
only. Entra app roles/groups are not consumed unless a separately approved
decision moves role ownership to the provider.

## Test identity

Unit, integration, smoke, and E2E harnesses use a throwaway local provider
(`src/test-utils/test-jwks-server.ts`): per-run RSA keypair, JWKS document,
and controlled minting (custom issuer/audience/expiry/algorithm/oid).
Production points `OIDC_AUTHORITY` at the real tenant. Test tokens never
leave the harness, and no test issues production credentials.

## Environment contract

| Variable | Backend | Required | Purpose |
|---|---|---|---|
| `OIDC_AUTHORITY` | yes | yes | Tenant authority (JWKS base) |
| `OIDC_CLIENT_ID` | yes | yes | This API's Entra application id |
| `OIDC_AUDIENCE` | yes | yes | Accepted access-token audience |
| `OIDC_ISSUER` | yes | no (defaults to authority) | Expected `iss` claim |
| `VITE_ENTRA_CLIENT_ID` | frontend | yes | SPA application id |
| `VITE_ENTRA_AUTHORITY` | frontend | yes | Tenant authority for MSAL |
| `VITE_ENTRA_API_SCOPE` | frontend | yes | Scope for API access tokens |
| `VITE_ENTRA_REDIRECT_URI` | frontend | no (defaults to origin) | Registered SPA redirect |
| `GHE_PYTHON_BIN` | backend | no | Python interpreter for doc-encryption sidecars |
| `TEST_JWKS_PORT` | test only | no (default 55439) | Throwaway provider port |
