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
