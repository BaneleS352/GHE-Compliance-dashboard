# Architecture Overview

## Project Structure

```
GHE-Compliance-Dashboard/
├── NodejsBackend/                  # REST API (Express + TypeScript + Prisma)
│   ├── src/
│   │   ├── config/                 # env, swagger, prisma client
│   │   ├── middleware/             # auth (JWT), authorization
│   │   ├── routes/                 # API route handlers
│   │   │   ├── admin/             # admin-only endpoints
│   │   │   ├── auth.ts            # login, me, preset-users
│   │   │   ├── declarations.ts    # CRUD, submit, status
│   │   │   ├── files.ts           # upload, download, delete
│   │   │   ├── reports.ts         # SLA, breakdown, export
│   │   │   └── workflows.ts       # pending, instances, approve
│   │   ├── services/
│   │   │   ├── workflowService.ts  # step resolution logic
│   │   │   ├── reports.ts          # report data computation
│   │   │   └── excelService.ts     # Excel buffer generation
│   │   └── __tests__/             # Vitest test suite (203 tests)
│   ├── prisma/                    # schema.prisma + migrations
│   └── docs/                      # Backend docs
│
├── Enterprise Compliance Platform/ # React + Vite frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/        # Shared React components (Card, StatusBadge, etc.)
│   │   │   ├── pages/             # Screen components (admin/, ApprovalQueue, etc.)
│   │   │   └── utils/             # client-side export utilities (excelExport.ts)
│   │   ├── services/
│   │   │   ├── api.ts             # HTTP API client (30+ wrapper functions)
│   │   │   ├── httpClient.ts      # fetch-based HTTP client with JWT injection
│   │   │   └── reports.ts         # consolidated report data fetcher
│   │   ├── __tests__/             # Vitest test suite (156 tests)
│   │   └── styles/                # CSS (Tailwind + custom animations)
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
    │       └── Decodes token → req.user { id, email, role }
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
| File storage | Local disk (`uploads/`) | Simple; replace with S3 for production |
| Workflow | JSON steps in `WorkflowInstance` | Flexible per-declaration step definitions |

## Authentication Flow

1. User posts email+password to `/api/auth/login`
2. Server verifies against `User.passwordHash` (bcrypt)
3. Returns JWT: `{ id, email, role }` signed with `JWT_SECRET`
4. Client sends JWT as `Authorization: Bearer <token>`
5. Middleware decodes JWT — role is read from token, NOT from DB

## Workflow Resolution

1. Declaration submitted → `createWorkflowSteps()` called
2. Reads `SystemConfig` for `highValueThreshold`, `mediumValueThreshold`
3. Calls `determineRuleId(value, high, medium)` to select rule
4. Loads `WorkflowRule.steps` (JSON of step definitions)
5. Resolves assignees from `User` table (lineManager, HR, CEO)
6. Stores resolved steps as JSON in `WorkflowInstance.steps`
7. Steps are frozen — config/rule changes don't cascade retroactively

## Test Philosophy

- 359 total tests (203 backend + 156 frontend)
- `break.test.ts`: 72 negative/attack tests (SQLi, XSS, JWT tampering, Zod bypasses)
- `edge-cases.test.ts`: 50 vulnerability boundary tests (mass assignment, self-approval, data leaks)
- `frontend-break.test.ts`: 31 HTTP-layer tests (error codes, network failure, malformed responses)
- Tests document confirmed bugs with `// BUG:` comments in assertions
