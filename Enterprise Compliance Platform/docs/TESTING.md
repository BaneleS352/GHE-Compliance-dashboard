# Frontend Testing Guide

## Quick Start

```bash
cd "Enterprise Compliance Platform"
npm install
npx vitest run          # Run all tests
npx vitest              # Watch mode
npx vitest --coverage   # With coverage report
```

## Test Files

| File | Tests | What's tested |
|------|-------|---------------|
| `auth-edge-cases.test.ts` | 10 | Login edge cases, token expiry, role-based access, session handling |
| `integration.test.ts` | 7 | App-level integration: routing, auth flows, API call mocking |
| `frontend-break.test.ts` | 31 | Component rendering under stress: missing props, invalid data, API errors, empty states |
| `ErrorBoundary.test.tsx` | 5 | React Error Boundary catches thrown errors, renders fallback UI |
| `UserContext.test.tsx` | 7 | User context provider: login state, token storage, role switching |
| `dashboard-render.test.tsx` | 1 | ApproverDashboard mounts without throwing runtime errors |

**Total: 61 tests**

## Running Individual Tests

```bash
# By file
npx vitest run src/__tests__/auth-edge-cases.test.ts

# By name pattern
npx vitest run -t "login"
```

## Component Coverage

| Component | Status |
|-----------|--------|
| LoginPage | Tested via auth-edge-cases, integration |
| ApproverDashboard | Tested via dashboard-render |
| ErrorBoundary | Tested via ErrorBoundary tests |
| UserContext | Tested via UserContext tests |
| ProtectedRoute | Tested via integration |
| LoginForm | Tested via auth-edge-cases |

## Mock Strategy

Tests use Vitest's `vi.mock()` to:
- Mock `window.fetch` / axios for API calls
- Mock `localStorage` / `sessionStorage` for token storage
- Mock `react-router-dom` navigation hooks
- Mock child components for isolation
