# Enterprise Compliance Platform

React frontend for the GHE Compliance Dashboard.

## Running

```bash
npm install
npm run dev          # Vite dev server (proxies /api to backend:3001)
```

## Testing

```bash
npm test             # Run the current frontend Vitest suite
```

### Current declaration UI

The New Declaration form displays Team Member Details in this order: Team Member Name, Team Member Code, Company, Department, Team Member Role/Position, and Approving Manager Name. The Approver Dashboard uses Pending Queue, Approved, Returned, and Declined KPI cards; Returned is counted from declarations with status `Returned`.

The Vitest suite covers MSAL identity flows, API client behavior, declaration
and approval screens, admin workflows, file downloads, and error/loading
states. Test files and counts change as the suite evolves; use the current
`npm test` output as the source of truth.

## Architecture

The frontend communicates with the backend REST API via an HTTP service layer:

```
Component → api.ts (high-level) → httpClient.ts (fetch wrapper) → Backend REST API
```

The Vite dev server proxies `/api` requests to `http://localhost:3001` (configured in `vite.config.ts`).
