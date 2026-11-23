# Architecture Overview

## Project Structure

```
GHE-Compliance-Dashboard/
├── docker-compose.yml              # frontend+backend+PostgreSQL+Azurite orchestration
├── .dockerignore                   # Excludes node_modules, .env, dist
├── DOCKER.md                       # Full Docker setup guide
├── NodejsBackend/                  # REST API (Express + TypeScript + Prisma)
│   ├── Dockerfile                  # Multi-stage TypeScript build
│   ├── entrypoint.sh               # Runs prisma migrate deploy, starts server
│   └── src/
│       ├── config/                 # env, swagger, prisma client
│       ├── middleware/             # OIDC auth, authorization
│       ├── routes/                 # API route handlers
│       │   ├── admin/             # admin-only endpoints
│       │   ├── auth.ts            # authenticated user profile
│       │   ├── declarations.ts    # CRUD, submit, status
│       │   ├── files.ts           # upload, download, delete
│       │   ├── reports.ts         # SLA, breakdown, aggregation, export
│       │   └── workflows.ts       # pending, instances, approve
│       ├── services/
│       │   ├── workflowService.ts  # step resolution logic
│       │   ├── reports.ts          # report data computation
│       │   ├── excelService.ts     # Excel buffer generation
│       │   └── notificationService.ts # Template rendering and transactional outbox enqueue
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
│   │   │   ├── httpClient.ts      # fetch-based HTTP client with MSAL token injection
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
    ├── OIDC Auth Middleware
    │       └── Decodes token → req.user { id, email, name, role, departmentId/derived department, position, organizationId }
    │
    ├── Route Handler
    │       ├── Zod validation
    │       ├── Role authorization
    │       └── Prisma DB operations
    │
    ├── PostgreSQL (BIGINT keys; Declaration.id stays the public GHE- reference)
    └── Azurite Blob Storage (private attachment container; metadata references stay in PostgreSQL)
```

## Key Design Decisions

| Area | Choice | Rationale |
|------|--------|-----------|
| Database | PostgreSQL everywhere (dev, CI, prod) | Single provider; native BIGINT identity keys; versioned migrations only |
| Auth | OpenID Connect / Entra bearer tokens | Provider authenticates; local User owns roles and organization scope |
| Validation | Zod schemas | Type-safe, composable, good DX |
| File storage | Azurite Blob container behind authenticated API routes | Single attachment store; PostgreSQL keeps metadata and opaque Azurite references |
| Workflow | Relational step/instance rows | Auditable per-declaration step history; no JSON fallback |
| Notifications | Validated templates + PostgreSQL outbox + SMTP worker | Durable queuing is separate from external delivery; SMTP is disabled until configured |
| Theme | Centralised `theme.ts` + CSS variables | Single source of truth for colours, gradients, status/priority maps |
| Docker | Multi-stage builds | Frontend container port 80 published on host port 3000; backend port 3001; PostgreSQL port 5432; PostgreSQL is the only provider (no provider rewriting) — versioned migrations run via `prisma migrate deploy` |

Attachment storage is intentionally Azurite-only. Local-disk metadata is accepted
only by the one-time migration command; API routes never fall back to reading or
writing files on disk. Azurite is an emulator, so this deployment choice does not
provide a production cloud-storage durability or availability guarantee.

PostgreSQL `AttachmentCleanupOutbox` rows make blob deletion retryable after
metadata deletion. Every API instance runs the same `SKIP LOCKED` worker; retries
use bounded exponential backoff and remain queued until Azurite confirms deletion.

## Authentication Flow

1. The SPA signs in through MSAL using Authorization Code + PKCE.
2. MSAL obtains an access token for the configured API scope.
3. The client sends it as `Authorization: Bearer <token>`.
4. Middleware validates issuer, audience, RS256 signature, lifetime, and `oid` through JWKS.
5. Middleware resolves the local User by configured issuer and immutable subject; links are established only through audited admin provisioning.
6. Local database role, organization, department, and manager relationships remain authoritative.

## Workflow Resolution

1. Declaration submitted → `createWorkflowSteps()` called
2. Reads `SystemConfig` for the high-value workflow threshold
3. Calls `determineRuleId(value, high, medium)` to select a workflow; the
   medium threshold parameter is accepted for API compatibility but ignored
4. Loads `WorkflowRuleStep` rows for the selected rule
5. Resolves assignees from `User` table (managerId FK and HR)
6. Stores resolved steps as `WorkflowInstanceStep` rows in the same transaction
7. Steps are frozen — config/rule changes don't cascade retroactively. Returned declarations are re-evaluated on save/resubmission so value changes can add newly required approvers while preserving valid completed approvals.

Workflow rule selection is `value >= highValueThreshold → rule 2`, otherwise `rule 1`. The `mediumValueThreshold` is configured in Admin Configuration and used with the high threshold to derive the stored priority label (`Low`/`Medium`/`High`); it does not select a separate workflow. It must not exceed the high threshold. The defaults are equal, so administrators must lower the medium threshold to create a Medium band. The server derives priority from value and configuration rather than trusting the client label. Line Manager assignees come from the employee's `managerId` FK; HR resolves to an approver in the employee's organisation where possible, then a global HR approver.

## Notifications

Workflow submission and approval transitions call `notificationService.ts` inside the workflow transaction. It resolves recipients from the user table, renders the configured event template, and calls the PostgreSQL `public.enqueue_email_notification` procedure to insert an idempotent `EmailOutbox` row. A separate email worker claims rows using `FOR UPDATE SKIP LOCKED`, records attempts and outcomes, and retries transient failures with bounded backoff. The preferred delivery boundary is the internal `EMAIL_API`; SMTP is retained only as a legacy fallback. Delivery is disabled by default and secrets are runtime configuration. Email delivery is at-least-once because a crash after provider acceptance but before recording success can cause a duplicate.

## Reports

Reports share inclusive date, department, and status filters with organization isolation. High-value results aggregate by employee and include values at or above `highValueThreshold`. Status breakdown and SLA data are available in the Reports screen alongside high-value and counterparty concentration reports.

## Test Philosophy

- Test counts are not maintained in this architecture document; run each
  package's test command for current counts.
- `break.test.ts` covers hostile input and authorization regressions (including
  SQL injection, XSS, token tampering, and validation bypasses).
- `edge-cases.test.ts` covers authorization, upload, workflow, and data
  integrity boundaries.
- `frontend-break.test.ts` covers API client error and network resilience.
- Regression tests describe the current expected behavior, even when they
  originated from a previously reported defect.
