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
- Client: `azp` must match one of `OIDC_ALLOWED_CLIENT_IDS`.
- Delegated permission: `scp` must contain `OIDC_REQUIRED_SCOPE`.
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
   exact audience, required `exp`/`iat`, allowed `azp`, and required `scp`.
   Invalid tokens return `401`; provider key/network outages return `503`.
2. Require a string `oid` and a non-empty email → else `401`.
3. Look up the local user **by email**. Unknown email → `403`
   (default-deny: no auto-provisioning in this compliance system).
4. If the row has no linked subject, the first successful login currently
   adopts the token subject with a conditional database update. This is a
   known residual risk: email is mutable and is not proof that the local
   account and provider identity belong together. Until a reviewed explicit
   linking workflow is implemented, provisioned email values and Entra
   email assignment must be controlled by the tenant administrator.
5. If the row has a linked subject different from the token subject,
   reject with `403` (fail closed on account mismatch — never re-link).
6. Populate `AuthRequest.user` (numeric id, role, display fields) from the
   row. Local role changes apply on the next request; tokens carry no role.

## Disablement and token revocation

The API validates signed access tokens locally against the configured issuer,
audience, claims, and cached/discovered signing keys. It does not call Entra
for each request, and the local `User` model currently has no suspension flag.
Consequently, revoking a provider session or disabling a provider account
does not provide immediate invalidation of an already-issued access token;
access is bounded by the token's `exp` unless the local account is removed or
another application-side authorization control is added. Tenant operators
must set an appropriately short access-token lifetime and use the existing
local account/role controls for urgent response. A local suspension control
is a follow-up item, not an implemented feature.

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
| `OIDC_AUDIENCE` | yes | yes | Accepted access-token audience |
| `OIDC_ALLOWED_CLIENT_IDS` | yes | yes | Comma-separated SPA client IDs accepted in `azp` |
| `OIDC_REQUIRED_SCOPE` | yes | yes | Delegated API scope required in `scp` |
| `OIDC_ISSUER` | yes | no (defaults to authority) | Expected `iss` claim |
| `VITE_ENTRA_CLIENT_ID` | frontend | yes | SPA application id |
| `VITE_ENTRA_AUTHORITY` | frontend | yes | Tenant authority for MSAL |
| `VITE_ENTRA_API_SCOPE` | frontend | yes | Scope for API access tokens |
| `VITE_ENTRA_REDIRECT_URI` | frontend | no (defaults to origin) | Registered SPA redirect |
| `GHE_PYTHON_BIN` | backend | no | Python interpreter for doc-encryption sidecars |
| `TEST_JWKS_PORT` | test only | no (default 55439) | Throwaway provider port |
