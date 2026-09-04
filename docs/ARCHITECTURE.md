# Architecture Overview

## Project Structure

```
GHE-Compliance-Dashboard/
├── docker-compose.yml              # 3-container orchestration (frontend+backend+postgres)
├── .dockerignore                   # Excludes node_modules, .env, dist
├── DOCKER.md                       # Full Docker setup guide
├── NodejsBackend/                  # REST API (Express + TypeScript + Prisma)
│   ├── Dockerfile                  # Multi-stage build (TSC + PostgreSQL swap)
│   ├── entrypoint.sh               # Runs prisma db push, starts server
│   └── src/
│       ├── config/                 # env, swagger, prisma client
│       ├── middleware/             # auth (JWT), authorization
│       ├── routes/                 # API route handlers
│       │   ├── admin/             # admin-only endpoints
│       │   ├── auth.ts            # login, me, preset-users
│       │   ├── declarations.ts    # CRUD, submit, status
│       │   ├── files.ts           # upload, download, delete
│       │   ├── reports.ts         # SLA, breakdown, aggregation, export
│       │   └── workflows.ts       # pending, instances, approve
│       ├── services/
│       │   ├── workflowService.ts  # step resolution logic
│       │   ├── reports.ts          # report data computation
│       │   ├── excelService.ts     # Excel buffer generation
│       │   └── notificationService.ts # Template rendering and webhook delivery
│       └── __tests__/             # Vitest test suite
│   ├── prisma/                    # schema.prisma + migrations
│   └── docs/                      # Backend docs
│
├── Enterprise Compliance Platform/ # React + Vite frontend
│   ├── Dockerfile                  # Multi-stage Vite→Nginx build
│   ├── nginx.conf                  # Proxies API requests to backend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/        # Shared React components (Card, StatusBadge, etc.)
│   │   │   ├── pages/             # Screen components (admin/, ApprovalQueue, etc.)
│   │   │   └── utils/             # client-side export utilities (excelExport.ts)
│   │   ├── config/
│   │   │   └── theme.ts           # Centralised brand colours, gradients, status/priority/type maps
│   │   ├── services/
│   │   │   ├── api.ts             # HTTP API client (30+ wrapper functions)
│   │   │   ├── httpClient.ts      # fetch-based HTTP client with JWT injection
│   │   │   └── reports.ts         # consolidated report data fetcher
│   │   ├── styles/
│   │   │   ├── theme.css          # CSS variables (--table-header-bg, --info-bg, --darkest, --purple-600)
│   │   │   └── index.css          # Tailwind + .card-shadow, .btn-gradient utilities
│   │   ├── __tests__/             # Vitest test suite
│   │   └── shell/
│   │       └── AppShell.tsx       # Layout shell (uses var(--background) — no hardcoded colours)
│   └── docs/                      # Frontend docs
│
└── docs/                          # Project-level docs
```

## Data Flow

```
Browser (React SPA)
    │
    ▼  HTTP (JSON)
Express API (port 3001)
    │
    ├── JWT Auth Middleware
    │       └── Decodes token → req.user { id, email, name, role, department, position, organizationId }
    │
    ├── Route Handler
    │       ├── Zod validation
    │       ├── Role authorization
    │       └── Prisma DB operations
    │
    └── SQLite / PostgreSQL
```

## Key Design Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| Database | SQLite (dev) / PostgreSQL (prod) | Prisma abstracts both; SQLite for zero-setup dev |
| Auth | JWT (self-contained) | No session store needed; role embedded in token |
| Validation | Zod schemas | Type-safe, composable, good DX |
| File storage | Local disk (`uploads/`) behind authenticated API routes | Simple; replace with object storage for production |
| Workflow | JSON steps in `WorkflowInstance` | Flexible per-declaration step definitions |
| Notifications | Validated templates + email webhook | Provider-independent delivery with safe development logging |
| Theme | Centralised `theme.ts` + CSS variables | Single source of truth for colours, gradients, status/priority maps |
| Docker | Multi-stage builds | Frontend container port 80 published on host port 3000; backend port 3001; PostgreSQL port 5432; backend image swaps SQLite provider to PostgreSQL

## Authentication Flow

1. User posts email+password to `/api/auth/login`
2. Server verifies against `User.passwordHash` (bcrypt)
3. Returns a one-hour JWT containing `id`, `email`, `role`, `name`, `department`, `position`, and `organizationId`, signed with `JWT_SECRET`
4. Client sends JWT as `Authorization: Bearer <token>`
5. Middleware decodes JWT — role is read from token, NOT from DB

## Workflow Resolution

1. Declaration submitted → `createWorkflowSteps()` called
2. Reads `SystemConfig` for `highValueThreshold`, `mediumValueThreshold`
3. Calls `determineRuleId(value, high, medium)` to select rule
4. Loads `WorkflowRule.steps` (JSON of step definitions)
5. Resolves assignees from `User` table (lineManager and HR)
6. Stores resolved steps as JSON in `WorkflowInstance.steps`
7. Steps are frozen — config/rule changes don't cascade retroactively. Returned declarations are re-evaluated on save/resubmission so value changes can add newly required approvers while preserving valid completed approvals.

Workflow rule selection is `value >= highValueThreshold → rule-2`, otherwise `rule-1`. The legacy `mediumValueThreshold` remains for API compatibility but does not select a separate workflow. Line Manager assignees come from the employee record; HR resolves to an approver in the employee's organisation where possible, then a global HR approver.

## Notifications

Workflow submission and approval transitions call `notificationService.ts`. It resolves recipients from the user table, renders the configured event template, and POSTs `{ to, subject, body, event, declarationId }` to `EMAIL_WEBHOOK_URL`. Without that variable, development mode logs the event. Delivery failures do not roll back workflow state.

## Reports

Reports share inclusive date, department, and status filters with organization isolation. High-value results aggregate by employee and include values at or above `highValueThreshold`. Status breakdown and SLA data are available in the Reports screen alongside high-value and counterparty concentration reports.

## Test Philosophy

- Test counts are intentionally not hard-coded here; run each package's test command for the current count.
- `break.test.ts`: 72 negative/attack tests (SQLi, XSS, JWT tampering, Zod bypasses)
- `edge-cases.test.ts`: 50 vulnerability boundary tests (mass assignment, self-approval, data leaks)
- `frontend-break.test.ts`: 31 HTTP-layer tests (error codes, network failure, malformed responses)
- Tests document confirmed bugs with `// BUG:` comments in assertions
