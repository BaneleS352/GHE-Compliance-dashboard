# CI and CD workflow map

## Continuous integration

`.github/workflows/ci.yml` is the repository's integration entry point. It
runs on pushes to every branch (not tags), on pull requests, and manually. It cancels
superseded runs for the same ref and calls four gates:

| Gate | Workflow | Coverage |
|---|---|---|
| Backend | `backend.yml` | Installs Node and Python document-protection dependencies; runs the backend Vitest suite and TypeScript/Prisma build. |
| PostgreSQL | `database.yml` | Uses an ephemeral PostgreSQL 16 service for integration checks, backend build, and clean-database smoke checks. |
| Frontend | `frontend.yml` | Runs typecheck, quality gate, Vitest, and production Vite build. |
| Browser | `postgres-normalization.yml` | Migrates and seeds a fresh PostgreSQL service, starts the throwaway JWKS provider and app servers, and runs desktop/mobile Playwright flows including developer quick login. |

`docker.yml` runs on pushes or pull requests to any branch when Docker inputs
change, and can also be started manually.
It validates and builds both the standard Entra images and the local stub
images. It then starts the stub Compose project and checks the Nginx-to-API
health route, the OpenID discovery/JWKS route, test-token minting, and a
database-backed `/api/auth/me` request for the seeded admin. Its teardown
removes only the isolated `ghe-compliance-stub` Compose project's containers
and volumes.

`secOps.yml` audits locked Node dependencies with `npm audit` and the pinned
Python sidecars with `pip-audit` when dependency manifests change on any
branch, on manual dispatch, and on a weekly schedule. It fails on
high-severity npm findings and any pip-audit finding.

## Continuous deployment and release limits

There is currently **no automatic deployment workflow**. The repository does
not define a registry, hosting target, environment approvals, deployment
credentials, or rollback mechanism. Docker CI builds and exercises images but
does not publish them. Production deployment remains the documented operator
process in [DEPLOY.md](DEPLOY.md).

The automated identity provider is intentionally the throwaway test JWKS
provider. It proves test and local stub behavior, not tenant configuration.
A release still needs the staging Entra sign-in/refresh/logout checks and
manual browser acceptance recorded in
[FRONTEND-AUDIT-REMEDIATION-PLAN.md](FRONTEND-AUDIT-REMEDIATION-PLAN.md).
Playwright runs with retries disabled for release evidence. The HTML report and
`test-results/` directory (failure screenshots/traces and export-verification
summaries) are uploaded as workflow artifacts with 14-day retention. Remaining
staging and external acceptance is tracked in
[TEST-COVERAGE-GOAL.md](TEST-COVERAGE-GOAL.md).

GitHub branch protection and required-check selection are repository settings
and cannot be guaranteed by workflow files alone. Configure the backend,
PostgreSQL, frontend, browser, Docker, and dependency-audit checks as required
for the protected release branches.
