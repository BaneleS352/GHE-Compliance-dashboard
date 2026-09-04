# GHE Compliance Dashboard — Agent Memory

## Project Overview

Gift, Hospitality & Entertainment compliance declaration management system.
Two-service architecture: Node.js/Express backend + React/Vite frontend.

| Service | Stack | Port |
|---------|-------|------|
| Backend | Express, Prisma, SQLite (dev) / PostgreSQL (prod) | 3001 |
| Frontend | React 18, Vite, TypeScript | 5173 (dev), 80 (Docker) |

## Key Paths

| Path | Purpose |
|------|---------|
| `NodejsBackend/src/routes/` | Express route handlers |
| `NodejsBackend/src/services/` | Business logic (Prisma queries) |
| `NodejsBackend/src/middleware/` | Auth middleware (`authenticate`, `authorize`) |
| `Enterprise Compliance Platform/src/app/pages/` | React page components |
| `Enterprise Compliance Platform/src/services/api.ts` | API client + `toApiDeclaration`/`mapDeclaration` mappers |
| `Enterprise Compliance Platform/src/types/declaration.ts` | `Declaration` interface (single source of truth) |
| `Enterprise Compliance Platform/src/config/theme.ts` | Colors, `DECISION_LABELS`, `APPROVAL_OPTIONS` |
| `Enterprise Compliance Platform/src/app/hooks/` | Custom hooks (`useWorkflowApproval`, etc.) |
| `NodejsBackend/src/seed.ts` | Test seed data |
| `NodejsBackend/prisma/schema.prisma` | DB schema + indexes |

## Testing

```bash
# Backend (360 tests, Vitest)
cd NodejsBackend && npm test

# Frontend (Vitest + Testing Library)
cd "Enterprise Compliance Platform" && npm test
```

Backend: 360/360 passing. Frontend: build clean.

## Known Patterns

### Frontend `Declaration` type
All fields use camelCase. Key field is `counterparty` (lowercase `c`), NOT `Counterparty`. The `Declaration` type at `src/types/declaration.ts` is the single source of truth.

### API ↔ Frontend mapping
- `toApiDeclaration()` in `services/api.ts` reads from `Declaration` type fields (lowercase) and sends to backend
- `mapDeclaration()` reads backend response (lowercase) and maps to `Declaration` type
- Both always use `counterparty` (lowercase), `approverId` (lowercase)

### Form state key naming in `NewDeclarationScreen.tsx`
Form state uses PascalCase keys (`Counterparty`, `employeeName`, etc.) mapped via `setF("Counterparty", value)`. When READING from form state for the API payload, use the PascalCase key: `form.Counterparty`. When WRITING from API response to populate form for editing, use PascalCase key for form state: `draft.counterparty` (lowercase from API) → `Counterparty` (uppercase for form).

### `sortFieldMap` in table components
Maps column header labels to data field names (lowercase camelCase). Example: `"Counterparty" → "counterparty"`. Field names must match the `Declaration` type property names exactly.

### Auth tokens in tests

## Recent Session Changes

All 34 documented audit findings (7 CRITICAL, 8 HIGH, 15 MEDIUM, 4 LOW) have been resolved:

### Security
- Removed static `/uploads` middleware (all file access via authenticated endpoint)
- `declarationId` now required on file upload (blocks orphan uploads)
- Added `authorize("admin", "approver")` to reports + `/stats`
- `GET /api/users/:id` available to authenticated users for manager/executive name resolution
- Role verification on approve endpoint (requires `approver` or `admin` role)
- Department scoping for Line Managers in declarations list; pending workflow assignments are user-scoped
- TOCTOU race fixed in workflows approve (single Prisma transaction)
- Error messages sanitized (no `err.message` leaks to client)

### Data
- `Counterparty` → `counterparty` renamed across all layers
- `approverId` mapped in `mapDeclaration()`, `toApiDeclaration()`, PUT `fieldMap`
- `/stats` includes `returned` count

### Performance
- N+1 eliminated in `GET /api/workflows/pending` (batched declarations)
- N+1 eliminated in `createWorkflowSteps` (batched line-manager lookup)
- N+1 eliminated in `getSLABreakdown` (batched workflow instances)
- `/stats` queries parallelized via `Promise.all`
- Delete operations parallelized via `Promise.all`
- DB indexes added to `prisma/schema.prisma`

### UX
- Loading states, error banners, empty states added to `AdminDashboard`, `ApprovalQueue`, `NewDeclarationScreen`
- try/catch added to `viewFile()`, `handleSaveEdit`, `handleDelete`
- `fetchConfig`/`fetchUserById` now have error logging
- `fetchCurrentUser()` has 8s timeout
- `httpClient` 204 returns `undefined` (not `null`)

### Auth & JWT
- JWT payload now includes `department` and `position` fields alongside `id`, `email`, `role`, `name`
- `AuthRequest.user` type in `middleware/auth.ts` includes `department?: string` and `position?: string`
- `GET /api/users/:id` now allows any authenticated user (needed for managers to look up user names)
- `GET /api/workflows/pending` removed department scoping (per-user pending assignments handle scope already)
- `GET /api/declarations` department scoping now only applies to `position === "Line Manager"` — HR sees all declarations

### Workflow Role Updates
- The active workflow supports Line Manager and HR steps only; CEO workflow steps and CEO-specific test flows were removed.
- Test tokens include `department` and `position` fields where needed for current role/scoping logic.

### Dashboard/Declarations Scoping Fix (all roles)
- Backend `GET /api/declarations` department scoping now only applies to `position === "Line Manager"` — HR sees all declarations, LM sees only their department
- `AuthRequest` type and JWT `auth.ts` include `position` for Line Manager/HR/scoping logic
- `ApproverDashboard.tsx` scopedDeclarations simplified — teamMembers see own only; all other roles see all backend-returned declarations (backend already scoping to department for LMs)
- Test helper tokens updated to include `department` and `position` fields matching production JWTs
- Dead `hasApprovedPredecessors` function removed
- `useWorkflowApproval.ts` cleaned up (removed erroneous backend code, restored React imports + correct paths)
- Test fixes for intentional security changes (file upload IDOR, report role guards)
- All `Counterparty` → `counterparty` fixes across 10 test files + source code

### Build
- Frontend `ApprovalQueue.tsx` JSX syntax error fixed (nested ternary bracket mismatch)
- Both `npm run build` passes cleanly for backend (`npx tsc`) and frontend (Vite)

### UI Updates (2026-09-03 to 2026-09-04)
- New Declaration Team Member Details fields reordered to: Team Member Name, Team Member Code, Company, Department, Team Member Role/Position, Approving Manager Name
- Counterparty helper text updated to `Full Name of the organisation or Team Member`
- Approver Dashboard Escalated KPI card replaced with Returned; Returned counts and filtering are supported
- Total KPI count and rand value now use the same font size
