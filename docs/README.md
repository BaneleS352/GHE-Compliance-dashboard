# GHE Compliance Dashboard documentation

This documentation describes the repository implementation as of 2026-09-02.

| Document | Use it for |
|---|---|
| [SETUP.md](SETUP.md) | Local prerequisites, environment, database, tests |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Services, request flow, roles, workflows, notifications |
| [API.md](API.md) | Route inventory, permissions, request conventions |
| [SCHEMA.md](SCHEMA.md) | Prisma models, JSON fields, indexes, seed data |
| [SECURITY.md](SECURITY.md) | Implemented controls and deployment responsibilities |
| [DEPLOY.md](DEPLOY.md) | Docker deployment and production checklist |

Additional package notes are in `NodejsBackend/docs/` and `Enterprise Compliance Platform/docs/`.

Quick links: API `http://localhost:3001/api/docs`, health `http://localhost:3001/api/health`, Docker UI `http://localhost:3000`, local UI `http://localhost:5173`.

The development seed uses password `password` for all seeded users and creates two organizations plus sample configuration and workflow data. Never use seed credentials outside development. Backend tests use isolated `@test.com` fixtures in `test.db`.
