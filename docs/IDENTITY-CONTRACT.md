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
3. Resolve the local user by `providerSubject`. Ordinary protected API routes
   do not provision users; an unknown subject returns `403`.
4. `GET /api/auth/me` is the login/profile-sync boundary. For non-test
   providers, it may create a least-privilege `teamMember` account after the
   backend verifies the caller's Graph identity and attempts the HIS lookup.
   A complete matching HIS record populates HIS-owned profile fields. A HIS
   lookup miss or optional HIS service failure creates a minimal account for a
   first login or preserves the existing profile. Graph permission failures,
   missing employee identifiers, identity mismatches, branch/department
   resolution failures, and local uniqueness conflicts remain errors.
5. Existing users are refreshed from HIS only during `/api/auth/me`; other API
   requests read the local row without triggering synchronization. Synchronization
   never changes local role, `isActive`, or application-owned data. Email and
   display name are not identity-link keys.
6. Populate `AuthRequest.user` (numeric id, role, display fields) from the
   verified local row. Local role changes apply on the next request; tokens
   carry no application role.

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
scope consistency, tenant discovery metadata, issuer equality, JWKS
reachability, and a noninteractive SPA authorization request using the
configured redirect and API scope. The preflight uses `prompt=none`, does not
follow redirects, and never redeems an authorization code. It can identify
tenant/resource/redirect errors such as `AADSTS500011` without printing the
provider response. An expected `login_required` response confirms only that
Entra returned the configured noninteractive request to its callback; it does
not prove that an authenticated user can obtain an API token or that consent
is granted. Complete verification by signing in through the SPA and confirming
`GET /api/auth/me` succeeds for a linked user.
For local checks, it mirrors the backend and Vite env-file roots and inherited
process environment; it does not assume the repository-root `.env` is loaded
by either service.
The verifier treats a shared SPA/API registration as supported and reports it
as information; separate registrations are recommended for least privilege
but are not required by the API token validator. It validates the fully
qualified delegated-scope format, checks the scope name against
`OIDC_REQUIRED_SCOPE`, and checks the default `api://<GUID>` resource against
`OIDC_AUDIENCE`. For a custom Application ID URI it reports that the URI must
be configured under **Expose an API** on the API registration. The live
authorization preflight checks whether Entra recognizes the requested client,
resource, scope, and redirect, and reports resource-not-found errors such as
`AADSTS500011` without exposing the provider response.
To verify the actual **Expose an API** registration fields, set
`ENTRA_GRAPH_ACCESS_TOKEN` in the current shell to a short-lived Microsoft
Graph access token with `Application.Read.All` and required admin consent.
The verifier reads the API app registration by `OIDC_AUDIENCE`, compares its
`identifierUris` with the resource URI requested by the SPA, and confirms the
requested delegated scope exists and is enabled. The token is never printed;
without it, this portal-backed check is reported as skipped.
In development it compares the configured redirect origin with Vite's default
`http://localhost:5173`; pass `--app-origin=http://localhost:<port>` if Vite is
running on another port. If `NODE_TLS_REJECT_UNAUTHORIZED=0` is inherited, the
verifier fails that check but forces strict TLS validation for its own provider
probes so it can still report redirect/resource errors.

## Authentication diagnostics

Browser diagnostics use fixed operation names such as `msal_initialize_or_redirect` and `api_auth_me`. They include only the error class, MSAL error code(s), MSAL correlation ID, API status, and API request ID when available. They do not include error messages, stacks, claims, request headers, bearer tokens, authorization codes, or configured secret values.

The verifier prints a short SHA-256 fingerprint of the tenant authority, SPA client ID, API scope, and redirect URI used by its authorization preflight. The SPA includes the same fingerprint with MSAL failures, allowing a developer to spot stale or different Vite runtime configuration without printing those values.

The API returns an `X-Request-Id` response header and logs that ID with a fixed authentication stage and reason (for example `delegated_scope / required_scope_missing` or `local_identity_lookup / identity_not_provisioned`). Its request log omits the URL and query string. Use the request ID to correlate an API response with server logs; MSAL correlation IDs apply to provider-side sign-in failures that happen before the API is called.
