# ERD Review Remediation

Status of the recommendations reviewed against the Prisma schema and application routes on 2026-10-28.

## Implemented in migration `0012_financial_precision_integrity`

| Finding | Disposition |
|---|---|
| Monetary values use floating-point storage | `Declaration.value` and configurable thresholds now use PostgreSQL `numeric(19,2)` / Prisma `Decimal`. Application response boundaries convert Decimal to JSON numbers. Migration preflight rejects values with more than two fractional digits instead of rounding them. |
| Priority lacks database validation | Added a `Low` / `Medium` / `High` check constraint and matching API validation. |
| Team member numbers can duplicate within an organization | Added normalized partial unique indexes, with a separate global uniqueness rule for users without an organization. API create/update reports conflicts as HTTP 409. |
| Department codes can duplicate within an organization | Added normalized partial unique index. |
| Declaration changes lack durable audit history | Added append-only `DeclarationAuditEvent` records for create, update, submit, workflow decision, admin status override, delete, upload, and file deletion. Records are written in the same transaction as their business change; the database blocks update/delete. `GET /api/declarations/:id/audit` uses declaration access rules. Events intentionally survive declaration, user, and organization deletion. |

The migration fails before applying constraints if existing data contains excess monetary precision, invalid priorities, or duplicate normalized identifiers. Reconcile such rows explicitly and retry; do not remove the preflight or allow implicit rounding.

## Already enforced

- Declaration type and lifecycle status, workflow step status, and workflow role checks are in migration `0009_domain_checks`.
- Organization short code, user email, team name within department, counterparty scoped name, workflow step identity, and one-to-one declaration child relationships have database uniqueness constraints or keys.
- Foreign-key join indexes are present in the Prisma schema.
- Organization consistency and declaration tenant boundaries are checked in application services/routes; see `docs/SCHEMA.md` for the enforcement points and limitations.

## Deliberate deferrals

- `position` remains free text by design: the application has no position-based report or approved title vocabulary to normalize against. Creating a Position catalog without those requirements would add maintenance overhead without enforcing a useful business rule.
- `UploadedFile.size` remains an integer because uploads are capped at 10 MB.
- Notification templates remain validated serialized JSON text to preserve the existing API contract.
- Direct database writes bypass route-level authorization and route-generated audit events. Operational access to the database must remain restricted; route audit records cover application operations, not arbitrary SQL changes.

## Manager relationship resolution

`User.managerId` is the only persisted current-manager relationship. Migration
`0013_user_manager_fk_only` drops the duplicated `lineManager` text after
backfilling only labels that resolve unambiguously to a same-organization or
global user; unresolved or ambiguous legacy labels stop the migration for
manual repair. The API keeps `lineManager` as a derived display field for
compatibility, while each declaration snapshot independently retains the
historical manager display name.

## Verification status

- Migration `0012_financial_precision_integrity` applied successfully to the configured local development database on 2026-10-28. Its preflight found no excess monetary precision, invalid priorities, or duplicate normalized identifiers.
- Migration `0013_user_manager_fk_only` applied successfully to the local development database; all 15 populated legacy manager labels were discarded in favor of their already-valid `managerId` references, and declaration snapshots remain intact.
- Backend tests: 448/448; PostgreSQL integration checks: 71/71; clean-database API smoke checks: 19/19.
- Playwright E2E exited successfully: 19 passed and 2 were flaky on the first attempt but passed on retry.
- The manager API contract tests verify that `/api/auth/me` and admin-user responses derive the display name from `managerId`, and legacy admin input resolves to the FK.
- Backend build and Prisma client generation passed.
- Backend tests: 446/446; frontend tests: 283/283.
- PostgreSQL integration checks: 69/69; clean-database API smoke checks: 19/19.
- Playwright E2E: 21/21, including developer quick login; the isolated rerun passed after changing login navigation to wait for `domcontentloaded`.
- Frontend typecheck, production build, quality gate, and `git diff --check` passed. The frontend build reports its existing large-chunk advisory.
