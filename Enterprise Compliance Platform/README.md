# Enterprise Compliance Platform

React frontend for the GHE Compliance Dashboard.

## Running

```bash
npm install
npm run dev          # Vite dev server (proxies /api to backend:3001)
```

## Testing

```bash
npm test             # 130 tests across 9 suites
```

### Test Coverage

| File | Tests | Focus |
|------|-------|-------|
| `auth-edge-cases.test.ts` | 11 | Auth service edge cases (empty/wrong credentials, hashing, screen access) |
| `db-edge-cases.test.ts` | 24 | Data layer edge cases (null/undefined, missing fields, boundary values) |
| `fuzz.test.ts` | 17 | Fuzz tests on db functions (random inputs, extreme values) |
| `fuzz-extended.test.ts` | 15 | Extended fuzz on admin/workflow/config functions |
| `integration.test.ts` | 19 | Full lifecycle, admin CRUD, config, dashboard KPIs |
| `ErrorBoundary.test.tsx` | 5 | Component error boundary render tests |
| `UserContext.test.tsx` | 7 | Auth context state, login/logout, localStorage persistence |
| `dashboard-render.test.tsx` | 1 | Smoke test for ApproverDashboard component |
| `frontend-break.test.ts` | 31 | **HTTP client breaking tests** |

### Breaking Tests (`frontend-break.test.ts` — 31 tests)

Tests the HTTP service layer (`src/services/httpClient.ts` and `src/services/api.ts`) by mocking `fetch`:

- **HTTP errors**: 401, 403, 404, 500 — verify `ApiClientError` is thrown with correct message
- **Network failure**: `TypeError: Failed to fetch` is propagated
- **Malformed responses**: non-JSON body, HTML response, empty 204 body
- **Auth headers**: Bearer token set correctly when token in localStorage, omitted when absent
- **HTTP methods**: GET/POST/PUT/PATCH/DELETE with correct headers and bodies
- **Query params**: URL building with status, search, role filters
- **Edge inputs**: special characters in paths, very long paths, null body, unexpected schema

## Architecture

The frontend communicates with the backend REST API via an HTTP service layer:

```
Component → api.ts (high-level) → httpClient.ts (fetch wrapper) → Backend REST API
```

The Vite dev server proxies `/api` requests to `http://localhost:3001` (configured in `vite.config.ts`).