# GHE Compliance Dashboard documentation

This documentation describes the repository implementation as of 2026-10-06.

The current declaration UI presents Team Member Details in this order: Team Member Name, Team Member Code, Company, Department, Team Member Role/Position, and Approving Manager Name. The supplier/customer/team-member/public-official field uses the helper text “Full Name of the organisation or Team Member”. Approver dashboards display Returned declarations as a KPI in place of Escalated declarations.

| Document | Use it for |
|---|---|
| [SETUP.md](SETUP.md) | Local prerequisites, environment, database, tests |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, request flow, roles, workflows, notifications |
| [API.md](API.md) | Route inventory, permissions, request conventions |
| [SCHEMA.md](SCHEMA.md) | Prisma models, JSON fields, indexes, seed data |
| [SECURITY.md](SECURITY.md) | Implemented controls and deployment responsibilities |
| [DEPLOY.md](DEPLOY.md) | Docker deployment and production checklist |
| [DATABASE-NORMALIZATION-GOAL.md](DATABASE-NORMALIZATION-GOAL.md) | Authoritative schema, migration, and data-integrity plan |
| [IDENTITY-CONTRACT.md](IDENTITY-CONTRACT.md) | Authoritative OpenID/Entra identity contract |

Additional package notes are in `NodejsBackend/docs/` and `Enterprise Compliance Platform/docs/`.

Supplementary project records: [QA-Questionnaire.md](../QA-Questionnaire.md), [MyDocument-GHE-Compliance.md](../MyDocument-GHE-Compliance.md), [NodejsBackend/README.md](../NodejsBackend/README.md), [NodejsBackend/docs/TESTING.md](../NodejsBackend/docs/TESTING.md), [NodejsBackend/docs/WORKFLOW.md](../NodejsBackend/docs/WORKFLOW.md), [Enterprise Compliance Platform/README.md](../Enterprise%20Compliance%20Platform/README.md), and [Enterprise Compliance Platform/docs/TESTING.md](../Enterprise%20Compliance%20Platform/docs/TESTING.md). Generated Playwright reports and historical design files are not authoritative technical documentation.

Quick links: API `http://localhost:3001/api/docs`, health `http://localhost:3001/api/health`, Docker UI `http://localhost:3000`, local UI `http://localhost:5173`.

The development seed creates two organizations plus sample configuration and workflow data. Authentication uses the OpenID/Entra contract; tests use a throwaway local JWKS provider. Never treat test identities or seed data as production credentials.
# Documentation completion workflow

Use the following order when closing a database, identity, or frontend change:

1. Update the relevant contract document before changing behavior.
2. Implement through migrations, typed services, and DTO mappers.
3. Add automated assertions for schema, API, and domain invariants.
4. Verify clean-start and upgrade paths on PostgreSQL.
5. Verify rendered browser behavior where the change is user-visible.
6. Verify staging/production configuration where the change depends on external identity or deployment settings.
7. Record evidence with commit, date, environment, command, and result.

Do not mark a task complete based only on source inspection or a unit-test pass. Each plan must distinguish implemented, automated-test verified, browser verified, and production verified.
