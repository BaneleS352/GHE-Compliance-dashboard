# OpenID Connect Integration and Codebase Cleanup Roadmap

> Status update (2026-10-06): the core OIDC cutover is implemented in the
> current branch. Backend middleware validates Entra-style RS256/JWKS tokens,
> resolves the provisioned local User, binds `providerSubject`, and keeps local
> roles/organization relationships authoritative. The SPA uses the MSAL
> adapter. Remaining roadmap items are cleanup, deployment hardening, and
> verification; the legacy password/JWT references below are inventory items,
> not the current authentication contract.
>
> Verification update (2026-10-06): legacy-surface sweep passes — no
> `jsonwebtoken`/bcrypt in dependencies or runtime code, no password-login
> or preset-user routes (absence pinned by `auth.test.ts`), MSAL-only
> frontend with sessionStorage cache and no demo path (production bundle
> scans clean), Swagger disabled in production and production seeding
> refused (both test-pinned), full gates green (backend 433/433,
> frontend 262/262, `pg:test` 67/67, `pg:smoke` 20/20). Still genuinely
> open: the staging-tenant run with real signed tokens, negative-auth
> results against staging, browser acceptance, and the rollback procedure
> (close-out items 1–8 below).

> Audit update (2026-10-08): local backend/frontend tests and builds still
> pass. The PostgreSQL gates were not re-run on the audit host because the
> dedicated `TEST_PG_DATABASE_URL` and `SMOKE_PG_DATABASE_URL` variables were
> absent. This is an environment-evidence gap, not a recorded application
> failure.

## Purpose

Move the GHE Compliance Dashboard from application-managed password/JWT authentication to Microsoft Entra ID OpenID Connect, while leaving one clear source of truth for identity, authorization, configuration, API contracts, and tests.

The target architecture is a React/Vite SPA using MSAL Authorization Code + PKCE to obtain an access token for the Express API. The API validates Entra access tokens using issuer, audience, signature/JWKS, and lifetime checks. The database remains authoritative for application users, roles, organization, managers, departments, and workflow permissions.

This is a roadmap, not a claim that the cutover is complete.

## Audit snapshot

### Current architecture

- Backend: Express, Prisma, PostgreSQL, bearer authentication middleware.
- Frontend: React/Vite, a central API client, `UserContext`, page-level role guards, and browser authentication state.
- Existing authentication is still represented across runtime code, schema, seeds, smoke scripts, tests, documentation, Docker configuration, and frontend fixtures.
- The repository currently contains an Entra/MSAL direction in progress, but the old authentication contract is still referenced by the test and operational harnesses.

### Legacy surface found

The following references must be removed or deliberately replaced:

- `JWT_SECRET`, `jsonwebtoken`, HS256 token creation, token payload helpers, and local bearer-token storage.
- `POST /api/auth/login` and `GET /api/auth/preset-users` documentation, tests, smoke checks, and UI assumptions.
- `User.passwordHash`, bcrypt seed logic, admin-user password handling, and password-related migrations/documentation.
- Frontend `setToken`, `clearToken`, `getAuthToken`, `ghe.auth.token`, password-login tests, and cached user fixtures.
- Test helpers that sign application JWTs directly instead of testing the authenticated-user contract.
- Docker, deployment, setup, API, security, schema, README, and testing documents that describe password/JWT authentication.

### Structural cleanup opportunities

- Authentication concerns are split between `src/app/auth`, `src/services/httpClient`, backend middleware, routes, seed scripts, and test helpers. Consolidate around explicit identity and API-auth modules.
- The frontend has both page navigation state and authentication state; define an explicit loading/authenticated/unauthorized state model so pages do not infer auth from stale storage.
- Provider claims, local user records, and local roles need separate types and mapping functions. Do not pass raw Entra claims into domain services.
- Runtime configuration is currently distributed across `.env` files, Docker Compose, Dockerfiles, Vite configuration, deployment docs, and test setup. Create a documented variable matrix with ownership and environment scope.
- Tests currently encode implementation details of the retired login path. Replace them with contract tests around token validation, identity resolution, authorization, and UI auth state.
- Swagger and operational documentation must be generated from the same route/auth contract and must not advertise removed endpoints.

## Target single sources of truth

| Concern | Single source of truth | Rule |
|---|---|---|
| Provider configuration | Backend/frontend environment contract documented in this roadmap and `.env.example` files | No duplicated secret names or undocumented fallbacks |
| Provider identity | `providerSubject` plus tenant/issuer identity | Never correlate by mutable display name |
| Application identity | Prisma `User` record and one identity-resolution service | Claims do not define local role or workflow data |
| Roles and permissions | Backend authorization policies and local database role model | Frontend guards are UX only, never security boundaries |
| API authentication | One backend middleware and one normalized `AuthRequest.user` contract | No route-specific token parsing |
| Frontend auth state | One MSAL adapter plus `UserContext` | No direct token/localStorage access in components |
| API calls | One HTTP client and one download client auth path | No ad hoc bearer construction |
| API contract | Route implementation plus Swagger and typed client mappings | Remove stale endpoint descriptions together |
| Test identity | Test-only normalized authenticated-user fixture/provider | Tests must not recreate production password/JWT issuance |
| Domain types | Existing declaration/user types, with auth/provider types separated | No duplicate user or role interfaces |

## Roadmap

### Phase 0 — Freeze and baseline

1. Record the current working-tree state and do not overwrite unrelated user changes.
2. Run the live backend, frontend, typecheck, build, PostgreSQL integration, smoke, and E2E commands from `AGENTS.md`.
3. Capture current failures separately from cutover failures.
4. Create an inventory checklist from the legacy search terms in this document.

Exit gate: baseline results are recorded, and every future failure can be attributed to a specific phase.

### Phase 1 — Define the identity contract

1. Define provider identity fields: tenant/issuer, object ID/subject, email fallback rules, display name, and optional Entra roles/groups.
2. Define the normalized backend identity type and the local-user resolution result.
3. Decide whether the database stores the provider object ID in a new dedicated column or an identity table. Prefer a dedicated identity mapping if multi-tenant or future providers are possible.
4. Define first-login behavior: deny until provisioned, or provision with an approved default role. For this compliance system, default-deny is the safer baseline.
5. Define role ownership: local roles remain authoritative unless a separate approved decision moves them to Entra app roles.

Exit gate: one written identity/authorization contract exists and all backend routes can consume it without raw provider claims.

### Phase 2 — Complete backend Entra validation

1. Centralize validated configuration for authority, issuer, API audience, tenant policy, allowed origins, and environment.
2. Implement one bearer-token validator using Entra discovery/JWKS and strict issuer, audience, algorithm, lifetime, and required-claim checks.
3. Implement one identity-resolution service that maps provider identity to the local `User` row and refreshes local role/organization/department data from the database.
4. Keep `authenticate` and `authorize` as the only route-facing auth middleware.
5. Return consistent `401` for invalid/missing tokens and `403` for valid but unprovisioned or unauthorized users according to the API contract.
6. Remove password login, preset users, local JWT issuance, and all unused auth dependencies.

Exit gate: no production code imports `jsonwebtoken` or bcrypt for authentication, no password login route exists, and all protected routes use the same middleware.

### Phase 3 — Remove password persistence safely

1. Remove password creation/comparison from seed, admin-user routes, scripts, and runtime code.
2. Add a Prisma migration to remove `passwordHash` only after all code references are gone.
3. Update seed data to create business users without credentials.
4. If provider identity mapping is stored, add constraints and indexes for issuer/tenant plus provider subject.
5. Update schema, baseline/retirement notes, and data migration documentation.

Exit gate: `rg` finds no runtime, seed, script, test, or documentation reference to `passwordHash`, password login, or bcrypt authentication.

### Phase 4 — Complete the React/MSAL client

1. Configure MSAL with `VITE_ENTRA_CLIENT_ID`, authority, API scope, and registered redirect URI.
2. Handle redirect completion once at application startup.
3. Keep MSAL-managed session state behind one adapter; components must not read token storage directly.
4. Acquire API access tokens silently and handle interaction-required failures by restarting provider sign-in.
5. Use one API client for JSON and one authenticated download helper for file responses.
6. Make `UserContext` expose explicit loading, authenticated, unauthenticated, and provisioned/unauthorized states.
7. Remove password fields, demo-user selectors, local token keys, and auth-related dead UI copy.

Exit gate: browser code has no raw token persistence or password login path, and all API requests use the same MSAL-backed token acquisition function.

### Phase 5 — Rewrite tests around contracts

1. Replace backend helpers that sign HS256 JWTs with a test authentication seam that injects a normalized identity or verifies controlled Entra-like claims.
2. Add focused validator tests for missing header, malformed token, wrong issuer, wrong audience, wrong algorithm, expired token, missing object ID, and unknown local user.
3. Preserve authorization coverage for every local role and workflow permission.
4. Remove tests for deleted login and preset-user routes.
5. Replace frontend token-storage tests with MSAL adapter mocks and tests for silent acquisition, interaction-required recovery, logout, loading, and unprovisioned users.
6. Update E2E setup to use a dedicated Entra test tenant or a controlled authenticated browser state; never commit real credentials.
7. Update smoke and PostgreSQL checks to inject test identities through the documented test seam.

Exit gate: backend and frontend suites pass without importing JWT signing libraries or asserting password login behavior.

### Phase 6 — Documentation and deployment alignment

Update these together:

- `docs/API.md`: remove password endpoints and document bearer audience and auth errors.
- `docs/ARCHITECTURE.md`: describe SPA-to-API Entra flow and local-user resolution.
- `docs/SETUP.md`: document required local variables and redirect URI registration.
- `docs/DEPLOY.md` and `DOCKER.md`: document secret management, HTTPS, CORS, reverse proxy, issuer/audience, and callback URLs.
- `docs/SECURITY.md`: document token boundaries, role ownership, logout, claim handling, and provider permissions.
- `docs/SCHEMA.md`: document provider identity mapping and removal of password storage.
- backend/frontend READMEs and testing guides: remove stale commands and demo credentials.
- Swagger: expose only current auth behavior.

Exit gate: repository documentation contains one consistent configuration table and no retired endpoint or secret name.

### Phase 7 — Production readiness

1. Register the SPA and API in Microsoft Entra.
2. Expose and register exact HTTPS redirect and post-logout URLs.
3. Create the API scope and grant it to the SPA.
4. Configure app roles/groups only if they are part of the approved authorization design.
5. Store secrets/certificates outside source control; do not put backend secrets in Vite variables.
6. Verify trusted proxy headers, HTTPS cookies if applicable, CORS, rate limits, logging redaction, and health checks.
7. Run manual login, logout, expired-session, unauthorized, role, and unprovisioned-user checks in staging.

Exit gate: staging login and API authorization work with real Entra tokens, and production configuration has no development fallback or demo identity path.

## Completion checklist

The integration is complete only when all of the following are true:

- Backend and frontend builds pass.
- Backend, frontend, PostgreSQL integration, smoke, and E2E gates pass or have explicitly documented provider-only limitations.
- No production or test code issues application-issued JWTs.
- No password field, bcrypt auth logic, demo-user endpoint, or stale token-storage key remains.
- Every protected API route uses the same authentication and authorization contract.
- Provider identity and local application identity are explicitly separated.
- Roles and workflow ownership remain database-authoritative unless formally changed.
- Environment variables, redirect URLs, API audience, scopes, and secrets are documented once.
- Swagger, docs, seed data, scripts, tests, Docker, and UI all describe the same authentication model.
- A repository-wide search for legacy terms returns only historical migration notes that are intentionally retained.

## Useful audit searches

```text
JWT_SECRET | jsonwebtoken | passwordHash | bcrypt | /api/auth/login | preset-users
ghe.auth.token | setToken | clearToken | getAuthToken | signToken
OIDC | Entra | MSAL | openid | access token | audience | issuer | JWKS
```
# Completion plan

Core OIDC implementation is present. The remaining roadmap is deployment and evidence work, not another authentication rewrite.

## Next implementation: release and staging verification

The next implementation should make the close-out evidence repeatable:

1. Add CI PostgreSQL service configuration and pass dedicated
   `TEST_PG_DATABASE_URL` and `SMOKE_PG_DATABASE_URL` values to the backend
   integration and clean-database smoke jobs.
2. Run backend tests/build and PostgreSQL gates serially so Prisma client
   generation cannot race Vitest or a second build process.
3. Add a Playwright release suite covering OIDC login/logout, declaration
   lifecycle, queue refresh, profile locking, organization isolation,
   protected exports, file flows, and expired/unauthorized/error states.
4. Run the suite against a clean migrated database and retain traces,
   screenshots, commit SHA, migration version, and date.
5. Execute the same suite against a staging Entra tenant with real signed
   tokens and record all negative-auth cases.
6. Document a rollback procedure for incorrect issuer, audience, redirect,
   or provider-user binding configuration.
7. Done 2026-10-08 — stale pre-OIDC instructions removed: TESTING.md
   manual sections now mint throwaway-provider tokens (`npm run
   test:provider` + `POST /test-token`) instead of the removed
   password-login/preset-users routes, coverage tables carry verified
   counts, and migration references run through `0010_auth_cutover`.

## Ordered close-out

1. Create a staging identity-provider application with the production-equivalent issuer, client ID, audience, redirect URI, and signing policy.
2. Configure the backend with staging values and verify issuer, audience, algorithm, lifetime, subject, and provider-user binding failures.
3. Verify first login, returning login, disabled local user, missing local user, subject mismatch, expired token, wrong audience, and wrong issuer behavior.
4. Verify the SPA obtains tokens through MSAL, sends them to the API, handles expiry, and clears local state on logout.
5. Confirm local database roles remain authoritative and cannot be elevated by token claims.
6. Confirm production builds have no password login, demo identity, preset credentials, development fallback, or credential logging.
7. Run backend/frontend tests, PostgreSQL integration/smoke gates, production builds, and browser acceptance using the staging identity provider.
8. Update this roadmap with commit, environment, migration version, test counts, browser evidence, and date.

## Required completion evidence

- A staging login/API run using real signed OIDC tokens.
- Negative authentication results for invalid issuer, audience, signature, expiry, subject, and local-user state.
- A production-build scan showing no demo credentials or password-auth runtime path.
- A documented rollback procedure for identity configuration errors.
- Confirmation that historical password/JWT references in this document are inventory only, or removal of any reference that is no longer useful.

Until these items are recorded, the OIDC migration is implemented but not production-ready.
