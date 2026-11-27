# Frontend Testing Guide

## Quick Start

```bash
cd "Enterprise Compliance Platform"
npm install
npx vitest run          # Run all tests
npx vitest              # Watch mode
npx vitest --coverage   # With coverage report
```

The test suite covers the MSAL-based identity flow, API client behavior,
declaration creation and history, approval workflows, admin screens, downloads,
and error/loading states. Use the live Vitest output for current file and test
counts; do not rely on historical counts in documentation.

## Running Individual Tests

```bash
# By file
npx vitest run src/__tests__/auth-edge-cases.test.ts

# By name pattern
npx vitest run -t "login"
```

## Mock Strategy

Tests use Vitest's `vi.mock()` to:

- Mock `window.fetch` / axios for API calls
- Mock MSAL account/token calls and `sessionStorage` where the identity cache is relevant
- Mock navigation and child components where isolation is useful
- Mock child components for isolation

## Playwright end-to-end tests

Browser tests live in `e2e/` and run in desktop and mobile projects. They use a
real backend, migrated PostgreSQL, real Azurite, and a controlled local email
capture server. Global setup also starts a throwaway local JWKS provider, so no
Entra tenant or production credentials are required. Protected-export checks use
the Python packages pinned in `NodejsBackend/requirements.txt`.

```powershell
cd "Enterprise Compliance Platform"
npx playwright install chromium
$env:E2E_PG_DATABASE_URL = "postgresql://user:password@localhost:5432/ghe_e2e?schema=public"
$env:AZURITE_CONNECTION_STRING = "<dedicated test Azurite connection string>"
npx playwright test --retries=0
```

Use dedicated E2E PostgreSQL and Azurite instances: setup applies migrations and
seeds fixtures. The suite covers authentication/sign-out and employee-ID OTP,
declaration creation/drafts/approval/return/rejection, attachments and rollback,
password-verified Excel/PDF exports, queue filtering/refresh, role boundaries,
profile locks, validation/empty/error/session states, admin CRUD, report totals,
and mobile declaration cards/lifecycle.

```bash
# Desktop contract tests only
npx playwright test declaration-contracts.spec.ts --project=desktop

# Mobile card flows only
npx playwright test mobile-interactions.spec.ts --project=mobile
```

Playwright writes failure screenshots/traces and an HTML report under
`test-results/` and `playwright-report/`; both are generated, ignored artifacts.
Release runs use `--retries=0` and CI uploads both artifact directories.
