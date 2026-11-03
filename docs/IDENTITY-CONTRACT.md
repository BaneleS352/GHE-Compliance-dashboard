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
- Audience: `OIDC_AUDIENCE` must exactly match the access token's `aud` claim.
  This API expects Entra v2 tokens, whose audience is the API registration's
  Application (client) ID; it is not the full `api://.../scope` string the SPA
  requests.
- Client: `azp` must match one of `OIDC_ALLOWED_CLIENT_IDS`.
- Delegated permission: `scp` must contain `OIDC_REQUIRED_SCOPE`.
- Subject: the Entra object ID (`oid` claim). Email and display name are read
  from the local application row and are not used to resolve identity.
- Raw provider claims never reach domain services. The middleware maps them
  to `AuthRequest.user` and drops everything else.

## Application identity

- The Prisma `User` row is authoritative for id, name, email, role,
  organization, department, manager, and workflow permissions.
- Provider linkage: `User.providerSubject` (globally unique) plus
  `User.providerIssuer`. The deployment supports one configured issuer;
  multi-issuer identity uniqueness is not supported. No mutable email or
  display name is used for correlation.

## Resolution algorithm (`middleware/auth.ts`)

1. Validate the bearer token: RS256 signature via JWKS, exact issuer,
   exact audience, required `exp`/`iat`, allowed `azp`, and required `scp`.
   Invalid tokens return `401`; provider key/network outages return `503`.
2. Require a string `oid` → else `401`.
3. Look up the local user by `providerSubject` and require its
   `providerIssuer` to equal the configured issuer. Unknown subject or issuer
   mismatch → `403` (default-deny: no auto-provisioning).
4. Login never creates or changes an identity link based on email. The local
   row supplies email and display fields.
5. Populate `AuthRequest.user` (numeric id, role, display fields) from the
   row. Local role changes apply on the next request; tokens carry no role.

## Explicit identity linking

An admin can call `POST /api/admin/users/:id/identity-link` for an unlinked
account. The request requires the Entra `oid` and an evidence reference to a
tenant-admin verification record. Before calling it, the tenant administrator
must verify that the immutable object ID belongs to the intended employee and
that the local account's role and organization are correct. The operation is
atomic, only succeeds for a row whose subject is still null, cannot replace a
link, and writes actor, target, issuer, subject, and evidence reference to
`IdentityLinkAudit`. A duplicate subject or already-linked account returns
`409`. Evidence documents must remain in the organization's approved record
system; the API stores only the reference. Recovery from a changed subject
requires a separate reviewed process; do not edit the link directly.

## Disablement and token revocation

The API validates signed access tokens locally against the configured issuer,
audience, claims, and cached/discovered signing keys. It does not call Entra
for each request.
Consequently, revoking a provider session or disabling a provider account
does not provide immediate invalidation of an already-issued access token;
access is bounded by the token's `exp` unless the local account is disabled.
The local `isActive` flag is checked on every authenticated
request and can be changed through the admin user update endpoint. Tenant
operators must also set an appropriately short access-token lifetime.

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

## Configuration verification

After filling the local backend `.env` and frontend `.env.local` from the
Entra app registrations, run `npm run auth:verify-config` from
`NodejsBackend`. The command checks required settings, SPA/API client and
scope consistency, tenant discovery metadata, issuer equality, and JWKS
reachability using normal TLS certificate validation. It does not print
configured values or prove that the client registration has consent or that
a user is provisioned. Complete verification by signing in through the SPA
and confirming `GET /api/auth/me` succeeds for a linked user.

## Authentication diagnostics

Browser diagnostics use fixed operation names such as `msal_initialize_or_redirect` and `api_auth_me`. They include only the error class, MSAL error code(s), MSAL correlation ID, API status, and API request ID when available. They do not include error messages, stacks, claims, request headers, bearer tokens, authorization codes, or configured secret values.

The API returns an `X-Request-Id` response header and logs that ID with a fixed authentication stage and reason (for example `delegated_scope / required_scope_missing` or `local_identity_lookup / identity_not_provisioned`). Its request log omits the URL and query string. Use the request ID to correlate an API response with server logs; MSAL correlation IDs apply to provider-side sign-in failures that happen before the API is called.
