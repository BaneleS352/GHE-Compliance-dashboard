## QA Questionnaire — GHE Compliance Dashboard

### 1. Number of users for the application?

12 seed users in the database (expandable via admin UI). 5 distinct roles: `teamMember` (7 users), `approver` (3 users: 1 Line Manager, 1 Head of HR, 1 Group CEO), `admin` (1 user). No hard limit on user count — new users can be created through the admin interface.

### 2. Number of images sent?

Not applicable. The application handles file uploads (declaration supporting documents), not images specifically. Uploads are stored as files on disk under `uploads/` and served exclusively through authenticated API endpoints. No image-specific processing or image-sending functionality.

### 3. What storage is being used?

- **Development**: SQLite (`file:./dev.db`), stored at `NodejsBackend/dev.db`
- **Production**: PostgreSQL (configured via `DATABASE_URL` environment variable; Prisma schema provider switches from `sqlite` to `postgresql` during the Docker build)
- **File uploads**: Stored on the server filesystem in the `uploads/` directory, served exclusively through the authenticated `GET /api/files/:id` endpoint (no public `/uploads` static middleware)

### 4. Who will the app be used by (internally or externally)?

**Internally only.** The application is designed for internal compliance staff at Hollywoodbets Group. Users include team members (Marketing, Sales, Finance, Operations, HR, IT, Legal), Line Managers, HR compliance officers, the Group CEO, and System Administrators. Access control is role-based with strict department scoping. There is no external-facing authentication or public access.

### 5. What security measures did you take?

- **Authentication**: JWT-based with `jsonwebtoken`. Tokens include `id`, `email`, `role`, `name`, `department`, `position`.
- **Authorization middleware**: `authenticate` (JWT verification + DB role re-validation on each request), `authorize(roles...)` (role-gated endpoints for admin/approver-only routes)
- **Role re-validation**: Each request re-checks the user's role against the database — role changes take effect immediately, even mid-token-lifetime
- **Input sanitization**: `sanitize()` applied to user-generated text fields; no raw `err.message` leaks to client responses
- **TOCTOU prevention**: Approval decisions wrapped in a single Prisma `$transaction` (read-check-write all in one atomic operation)
- **IDOR prevention**: File uploads require a valid `declarationId` (prevents orphan uploads); team members cannot access other users' declarations
- **Access control**:
  - Team members: only their own declarations
  - Line Managers: department-scoped declarations
  - HR, CEO, Admin: all declarations
- **File access**: No public `/uploads` static middleware — all file downloads go through the authenticated `GET /api/files/:id` endpoint
- **Async error handling**: All async route handlers wrapped with `asyncHandler` to prevent uncaught promise rejections
- **Self-approval guard**: Cannot approve your own declaration
- **Step-order guard**: Cannot skip workflow steps (prior steps must be approved first)
- **Step-assignee isolation**: Each workflow step is assigned to a specific user; other users cannot act on steps assigned to someone else

### 6. Language the app is built with?

- **Backend**: TypeScript (Node.js + Express, Prisma ORM)
- **Frontend**: TypeScript (React 18, Vite build tool, Tailwind CSS)
- **Database migrations**: Prisma Migrate / Prisma Client
- **Testing**: Vitest (backend: 360 unit/integration tests; frontend: component tests)
- **E2E Testing**: Playwright (16 tests across approval flows and reports)
- **Containers**: Docker + Docker Compose (NGINX for frontend, Node for backend)

### 7. Detailed system overview, including architecture, data storage locations, and integration points

**Architecture**: Two-service architecture running in Docker containers.

```
┌─────────────────────┐      ┌─────────────────────┐      ┌──────────────┐
│  Frontend           │      │  Backend             │      │  Database    │
│  React 18 + Vite    │ ───▶ │  Express + Prisma    │ ───▶ │  PostgreSQL  │
│  (port 80 / 5173)   │      │  (port 3001)         │      │  (internal)  │
│  NGINX (prod)       │ �-�─── │  JWT Auth Middleware │      └──────────────┘
└─────────────────────┘      └─────────────────────┘
```

**Directory structure**:
- `NodejsBackend/` — Express REST API
  - `src/routes/` — Route handlers (auth, declarations, workflows, files, users, reports, admin/*)
  - `src/services/` — Business logic (workflowService, reports, excelService)
  - `src/middleware/` — Auth middleware (authenticate, authorize)
  - `src/config/` — Prisma client, env config
  - `prisma/schema.prisma` — Database schema
  - `src/__tests__/` — 360 backend tests
- `Enterprise Compliance Platform/` — React SPA
  - `src/app/pages/` — Page components (MyDeclarationsScreen, NewDeclarationScreen, ApprovalQueue, ApproverDashboard, AdminDashboard, etc.)
  - `src/app/hooks/` — Custom hooks (useWorkflowApproval)
  - `src/services/` — API client, httpClient
  - `src/types/` — TypeScript interfaces (Declaration, User)
  - `src/app/auth/` — Auth context, authService, dev login
  - `e2e/` — Playwright E2E tests (16 tests)

**Data storage locations**:
- **Database**: PostgreSQL (production) / SQLite (development), stores users, declarations, workflow instances, approval options, configs, and system settings
- **File uploads**: Server filesystem `uploads/` directory
- **No external data storage**: All data lives within the application's database and filesystem

**Integration points**:
- No external API integrations. The application is fully self-contained.
- All communication is between the React frontend and the Express backend via REST API calls.
- Authentication is handled internally via JWT (no OAuth, SSO, or third-party auth providers).

**Key API routes**:

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | JWT generation |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/declarations` | List declarations (role-scoped) |
| POST | `/api/declarations` | Create draft |
| PUT | `/api/declarations/:id` | Update draft |
| PATCH | `/api/declarations/:id/submit` | Submit → creates workflow |
| POST | `/api/workflows/approve` | Approve/decline/return |
| GET | `/api/workflows/pending` | Pending approvals queue |
| POST | `/api/files/upload` | Upload file |
| GET | `/api/files/:id` | Download file |
| GET | `/api/users/:id` | Fetch user profile |
| GET | `/api/reports/*` | Reports (exports, breakdowns) |
| POST | `/api/admin/users` | Create user (admin) |
| GET | `/api/health` | Health check |

### 8. Confirm timelines and expectations

No specific timelines configured in the codebase. The application is development-complete:

- **Backend**: 360/360 tests passing across 16 test files
- **Frontend**: Build clean (Vite production build passes without errors)
- **E2E tests**: 16 Playwright tests structured and ready for manual execution
- **Docker build**: Docker Compose builds and deploys both services

The application is ready for immediate deployment and use.

### 9. Data archiving processes

No automated data archiving in the codebase. Current behavior:

- **Declarations**: Stored indefinitely in the database with full history. Each declaration retains its status, workflow steps (including decisions, notes, and timestamps), and associated metadata. No soft-delete, archival, or data retention policy is implemented.
- **File uploads**: Stored on disk in `uploads/`. Linked to declarations via a JSON array field on the declaration record. Deleting a declaration orphans its associated file records (known technical debt — no cascade delete or archival on file records).
- **Workflow instances**: Stored as JSON with full step history. Never purged.

### 10. User verification and fraud prevention controls

- **Password-based login**: Email + password authentication with bcrypt password hashing
- **JWT tokens**: Signed with configurable `JWT_SECRET` using HS256, configurable expiry
- **Role re-validation**: Each request re-checks the user's role against the database — revoked privileges take effect immediately
- **Self-approval guard**: Blocked at the API level — users cannot approve their own declarations
- **Step-order enforcement**: Prior workflow steps must be approved before later steps can be acted on
- **Step-assignee isolation**: Each workflow step is assigned to a specific user ID; only that user can act on it
- **Department scoping**: Line Managers see only their department's declarations; team members see only their own
- **Input validation**: Zod schemas validate declaration creation payloads
- **File type validation**: Upload endpoint rejects executable files (.exe, .html, etc.)
- **Separation of duties**: Declarations must go through LM → HR → CEO (high-value) or LM → HR (medium) or LM (low) approvers before being fully approved

### 11. Expected deployment date

Not specified in the codebase. The project is ready for deployment — all tests pass and both services build cleanly.

### 12. Date for the app to be used

Not specified. The application is ready for immediate use. Seed data includes 12 users (Nomvula Dlamini, Sipho Nkosi, Lindiwe Zulu, Sandile Shabalala, System Admin, etc.) and 12 declarations in various workflow statuses (Draft, Pending, Approved, Declined, Returned), enabling immediate testing and onboarding.
