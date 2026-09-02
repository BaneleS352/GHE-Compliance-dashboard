# API reference

Base URL: `http://localhost:3001`; JSON requests use `Content-Type: application/json`. Protected routes require `Authorization: Bearer <JWT>`. Interactive Swagger documentation is served at `/api/docs`.

## Public and health

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness response |
| POST | `/api/auth/login` | Authenticate with email and password |
| GET | `/api/auth/preset-users` | Development login presets |

`/api/auth/me` is protected and returns the current user.

## User and declaration routes

| Method | Path | Access |
|---|---|---|
| GET | `/api/users/managers`, `/departments`, `/organizations`, `/:id` | authenticated |
| GET | `/api/declarations`, `/:id` | authenticated; results are organization/role scoped |
| POST | `/api/declarations` | authenticated; create draft |
| PUT/DELETE | `/api/declarations/:id` | owner/admin as enforced by route |
| PATCH | `/api/declarations/:id/submit` | declaration owner/admin |
| PATCH | `/api/declarations/:id/status` | authenticated status update with validation |
| GET | `/api/declarations/stats` | `admin` or `approver` |

## Workflow and files

| Method | Path | Access |
|---|---|---|
| GET | `/api/workflows/pending` | authenticated; only assigned pending work is returned |
| GET | `/api/workflows/instances/:declarationId` | authenticated and scoped |
| POST | `/api/workflows/approve` | authenticated; role and assignment are verified |
| POST | `/api/files` | authenticated; `declarationId` is required |
| GET/DELETE | `/api/files/:id` | authenticated and declaration-scoped |

Workflow decisions include `accept`, `org`, `foundation`, `decline`, and `return` as configured by approval options. Returned declarations can be edited and resubmitted; approval transitions are persisted transactionally.

## Reports and administration

Reports (`admin` or `approver`): `GET /api/reports/counterparty-concentration`, `/status-breakdown`, `/sla`, `/high-value`, `/list`, and `/export`. Report filters are query parameters such as date range, department, and status.

Admin-only namespaces:

- `/api/admin/dashboard` — dashboard aggregates
- `/api/admin/users` — list, read, create, update, delete users
- `/api/admin/config` — system config, dropdowns, approval options, organizations
- `/api/admin/workflows/rules` — workflow rule CRUD

## Errors and conventions

Successful mutations return the affected resource or a confirmation; deletes may return `204`. Validation and authorization failures use 4xx responses. Unknown routes return `{ "error": "Not found" }`; unexpected failures return `{ "error": "Internal server error" }`. Do not rely on error message text as a stable API contract.
