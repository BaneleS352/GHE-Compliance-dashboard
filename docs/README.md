# GHE Compliance Dashboard documentation

This documentation describes the repository implementation as of 2026-09-04.

The current declaration UI presents Team Member Details in this order: Team Member Name, Team Member Code, Company, Department, Team Member Role/Position, and Approving Manager Name. The supplier/customer/team-member/public-official field uses the helper text “Full Name of the organisation or Team Member”. Approver dashboards display Returned declarations as a KPI in place of Escalated declarations.

| Document | Use it for |
|---|---|
| [SETUP.md](SETUP.md) | Local prerequisites, environment, database, tests |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, request flow, roles, workflows, notifications |
| [API.md](API.md) | Route inventory, permissions, request conventions |
| [SCHEMA.md](SCHEMA.md) | Prisma models, JSON fields, indexes, seed data |
| [SECURITY.md](SECURITY.md) | Implemented controls and deployment responsibilities |
| [DEPLOY.md](DEPLOY.md) | Docker deployment and production checklist |

Additional package notes are in `NodejsBackend/docs/` and `Enterprise Compliance Platform/docs/`.

Supplementary project records: [QA-Questionnaire.md](../QA-Questionnaire.md), [MyDocument-GHE-Compliance.md](../MyDocument-GHE-Compliance.md), [NodejsBackend/README.md](../NodejsBackend/README.md), [NodejsBackend/docs/TESTING.md](../NodejsBackend/docs/TESTING.md), [NodejsBackend/docs/WORKFLOW.md](../NodejsBackend/docs/WORKFLOW.md), [Enterprise Compliance Platform/README.md](../Enterprise%20Compliance%20Platform/README.md), and [Enterprise Compliance Platform/docs/TESTING.md](../Enterprise%20Compliance%20Platform/docs/TESTING.md). Generated Playwright reports and historical design files are not authoritative technical documentation.

Quick links: API `http://localhost:3001/api/docs`, health `http://localhost:3001/api/health`, Docker UI `http://localhost:3000`, local UI `http://localhost:5173`.

The development seed uses password `password` for all seeded users and creates two organizations plus sample configuration and workflow data. Never use seed credentials outside development. Backend tests use isolated `@test.com` fixtures in `test.db`.
