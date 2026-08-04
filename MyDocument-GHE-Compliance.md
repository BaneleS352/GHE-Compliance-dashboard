# 5. Documents Required from Requestor / AI Team

These documents and evidence items must be provided to Live Development for review. They may be linked to a ticket, repository, document library or release folder.

Table 5: Evidence required from requestor or AI team

| ****Required Evidence**** | ****Provided? Yes/No**** | ****Link / Location**** | ****Owner / Notes**** |
| --- | --- | --- | --- |
| Business case / problem statement | Yes | Project README / docs/README.md | GHE (Gift, Hospitality & Entertainment) Compliance Dashboard to manage the declaration, review and approval of gifts, hospitality and entertainment received or given by Hollywoodbets Group employees, ensuring regulatory compliance. |
| Business requirements and acceptance criteria | Yes | Project Documentation / README | Requirements include declaration creation, automated workflow steps (LM → HR → CEO), approval queue, reports, file attachments, user administration, configurable thresholds and role-based access control. |
| Architecture diagram and design notes | Yes | docs/ARCHITECTURE.md | Two-service architecture: Express/Prisma backend and React/Vite frontend. Backend handles authentication, workflow logic and data storage; frontend provides the compliance interface. |
| Data flow diagram and data classification | Yes | docs/ARCHITECTURE.md | Internal business information. Declaration data flows from the React frontend through the Express API into SQLite (dev) / PostgreSQL (prod). Workflow instances track approval step history. |
| Security requirements and threat / risk notes | Yes | docs/SECURITY.md | JWT authentication, role-based authorization, department scoping, sanitised error messages, TOCTOU-safe transactions, authenticated file downloads, no public uploads. |
| Authentication and access control design | Yes | docs/SECURITY.md / middleware/auth.ts | JWT-based authentication with bcrypt password hashing. Roles: teamMember, approver (Line Manager / Head of HR / Group CEO), admin. Authorization middleware enforces role and department scoping. |
| Source code repository access / package access | Yes | Source Code Repository | Project maintained in GitHub (GHE-Compliance-dashboard repository). Two folders: NodejsBackend and Enterprise Compliance Platform. |
| Branching strategy and pull request link | No | N/A | Currently under active development. Git branching strategy and pull requests to be implemented before production deployment. |
| Dependency list and licensing notes | Yes | package.json (backend + frontend) | Express, Prisma, jsonwebtoken, bcrypt, zod, cors, multer, exceljs (backend). React 18, Vite, TypeScript, Tailwind CSS, Recharts (frontend). Node.js runtime. |
| Build instructions and CI/CD pipeline details | Partial | README.md | Backend: `npm run build` (tsc). Frontend: `npm run build` (vite). Docker Compose builds both services. CI/CD pipeline not yet fully implemented; GitHub Actions recommended for production. |
| Environment, hosting and infrastructure requirements | Yes | README.md / docker-compose.yml | Node.js (backend, port 3001), NGINX (frontend, port 80), PostgreSQL (production) / SQLite (development). Docker Desktop required for containerised deployment. |
| Database schema / migration scripts / data requirements | Yes | prisma/schema.prisma | Prisma schema: User, Declaration, WorkflowRule, WorkflowInstance, SystemConfig, Dropdowns, ComplianceTrendPoint, TypeBreakdownItem, ApprovalOption, UploadedFile. Indexes added on employeeId, status, department, approverId, position, lineManager, counterparty, declarationId. |
| Integration specifications and API details | Yes | NodejsBackend/src/routes/ | REST API endpoints for auth, declarations, workflows, files, users, reports and admin (dashboard, users, config, workflows). No external API integrations. |
| Test cases, test results and regression evidence | Partial | NodejsBackend/src/__tests__/, Enterprise Compliance Platform/src/__tests__/ | 360 backend tests passing (Vitest) across 16 test files. 15 frontend unit/component test files (Vitest). Frontend build clean. 16 Playwright E2E tests written but not yet passing (in progress). |
| Deployment steps and rollback plan | Partial | README.md / Docker | `docker compose up -d --build` deploys both services. Rollback: revert to previous image / git commit. Formal production deployment and rollback procedures to be documented prior to release. |
| Logging, monitoring and alerting design | Partial | NodejsBackend/src/ | Backend console logging for DB lookup failures and errors. Additional monitoring and alerting to be implemented for production (e.g., structured logging, health check endpoint at `/api/health`). |
| Operational reports and dashboard links | Yes | /api/reports/* | Status breakdown, SLA breakdown, high-value declarations, counterparty concentration, exports (Excel). Access restricted to admin/approver roles. |
| SOP, Knowledge Base and support notes | Partial | Project README / AGENTS.md | Standard Operating Procedure covers user onboarding, declaration review, workflow administration, report generation and troubleshooting. Support owned by the application owner. Formal SOP and Knowledge Base to be produced. |
| User training and support training material | No | N/A | End-user and administrator training material is planned. End-user guidance covers declaration submission, draft editing, resubmission, approval decisions and file attachments; administrator training covers user management, workflow rules, config and reports. To be produced. |
| Known issues, risks and open decisions | Yes | MyDocument-GHE-Compliance.md (this document) | Known issues: deleting a declaration orphans associated file records (no cascade). Open decisions: production CI/CD implementation, structured monitoring and alerting, data retention and archiving policy. Risks: department-scoping correctness across roles, JWT expiry and role changes. |

# 6. Form A - Project Take-On Form

Completed by the business requestor and AI team before Live Development starts intake review. Mandatory fields should not be left blank.

Table 6: Project Take-On Form

| ****Section**** | ****Field**** | ****Response / Details**** |
| --- | --- | --- |
| Business Info | Project Name: | GHE Compliance Dashboard |
| Requestor: | Hollywoodbets Group – Compliance |
| Business Area: | Corporate Compliance / Governance |
| Problem Statement: | The Hollywoodbets Group required an automated solution to collect, track and approve Gift, Hospitality & Entertainment (GHE) declarations from employees. The previous manual process lacked visibility, workflow enforcement and auditability. |
| Expected Benefit: | Automate declaration capture, enforce a consistent approval workflow, provide real-time status visibility, reduce administration, ensure regulatory compliance and maintain a complete audit trail. |
| Technical Info | Technology Used: | TypeScript, Node.js, Express, Prisma, React 18, Vite, Tailwind CSS, SQLite (dev) / PostgreSQL (prod), Docker |
| AI Platform Used: | N/A – no AI components. The system is a deterministic rules-based workflow application. |
| Hosting Requirements: | Three Docker Compose containers: backend Node.js container (port 3001), frontend NGINX container (port 80), PostgreSQL 16 database container (port 5432). Persistent volumes: `pgdata` (database) and `uploads` (files). No external public exposure beyond the organisation. |
| Database Requirements: | PostgreSQL (production) via Prisma ORM. SQLite used for local development. Prisma schema is the system of record. |
| Integrations: | No external integrations. React frontend → Express API → Prisma database. File uploads stored on the server filesystem and served via authenticated endpoints. |
| Operational Info | Number of Users: | 12 seeded users (expandable). Internal compliance staff: team members, Line Managers, Head of HR, Group CEO, System Administrator. No external users. |
| Criticality: | Medium-High. Internal compliance system. Availability is important during reporting and audit periods. |
| Support Requirements: | Application owner for business support. System Administrator for hosting, database and deployment support. |
| Escalation Requirements: | Level 1 – Application Support → Level 2 – System Administrator → Level 3 – Solution Developer. |
| Risk Info | Customer Impact: | Internal compliance system. Incorrect or unavailable declaration data could affect audit readiness and regulatory reporting. No customer-facing transactional systems are affected. |
| Security Requirements: | JWT authentication with bcrypt password hashing and login rate limiting (10 req/min). Role-based authorization (teamMember, approver, admin) and department scoping. Authenticated file downloads only. TOCTOU-safe approval transactions. Sanitised error messages (no internal details leaked). |
| Data Classification: | Internal business information. Declaration data includes employee name, department, position, line manager, counterparty details and GHE values. No customer personal information, financial or regulated personal data beyond employee declarations. |
| Deliverables | Documentation: | - README.md - Security Design Notes (docs/SECURITY.md) - AGENTS.md (project memory) - QA Questionnaire (QA-Questionnaire.md) - This Take-On Form |
| Source Code: | - Backend (Express, Prisma, routes, services, middleware, seed data) - Frontend (React 18, Vite, TypeScript, pages, hooks, services) - Prisma schema - Docker Compose - E2E Playwright tests |
| Test Cases: | - 360 backend unit/integration tests (Vitest) - 15 frontend unit/component test files (Vitest) - Approval workflow paths (LM → HR → CEO) - Department scoping and role isolation - File upload / download validation - Reports and exports - 16 Playwright E2E tests written (approval flows, reports), currently being fixed |

# 9. Form D - AI Technical Handover Request

Completed by the AI team before code review or deployment readiness review. Provide links where evidence is stored elsewhere.

| ****Area**** | ****Required Detail**** | ****Response / Link**** |
| --- | --- | --- |
| Solution overview | What does the solution do and what problem does it solve? | The GHE Compliance Dashboard automates the collection, tracking and approval of Gift, Hospitality & Entertainment declarations for Hollywoodbets Group employees. Employees submit declarations; a configurable workflow routes them through Line Manager → HR → CEO approval steps based on value thresholds. The system provides role-based visibility, an approval queue, reports, file attachments and a full audit trail. |
| Repository / source code link | Repository URL, branch, pull request, package or artifact location. | Source code maintained in GitHub (GHE-Compliance-dashboard repository). Two folders: NodejsBackend (Express API) and Enterprise Compliance Platform (React frontend). Branching strategy to follow main, develop and feature branches. |
| AI platform details | AI platform, model, prompt/configuration pattern and any runtime dependencies. | N/A – no AI platform or models used. The approval workflow is deterministic and rules-based. |
| Technology stack | Languages, frameworks, packages, build tools and runtime requirements. | Backend: TypeScript, Node.js, Express, Prisma, jsonwebtoken, bcrypt, zod, multer, exceljs. Frontend: TypeScript, React 18, Vite, Tailwind CSS, Recharts. Testing: Vitest, Playwright. Deployment: Docker / Docker Compose. |
| Architecture | Architecture diagram, service boundaries, components and dependencies. | Two-service architecture: (1) Express/Prisma backend (REST API, JWT auth, workflow engine, reports, file storage); (2) React/Vite frontend (SPA with role-based screens). Data flows frontend → API → database. Workflow instances store approval step history as JSON. |
| Hosting | Environment, hosting platform, scaling, capacity and region requirements. | Three Docker Compose containers: backend Node.js container (port 3001), frontend NGINX container (port 80), PostgreSQL 16 database container (port 5432). Persistent volumes: `pgdata` (database) and `uploads` (files). Internal hosting, no public exposure. |
| Database | Database type, schema changes, migrations, retention and backup requirements. | Prisma ORM with PostgreSQL (prod) / SQLite (dev). Models: User, Declaration, WorkflowRule, WorkflowInstance, SystemConfig, Dropdowns, ComplianceTrendPoint, TypeBreakdownItem, ApprovalOption, UploadedFile. Migrations via `prisma db push` / Prisma Migrate. Retention and backup policies to be defined by the organisation. |
| Integrations | Internal/external systems, APIs, queues, files, schedules and contracts. | No external integrations. Internal REST API consumed by the React frontend. File uploads stored on the server filesystem and served via authenticated `/api/files/:id`. No external APIs, queues or schedules. |
| Authentication | Authentication provider, identity flow, token handling and service accounts. | JWT-based authentication issued on login (bcrypt password hashing, login rate limited to 10 req/min). Tokens carry id, email, role, name, department and position. `authenticate` middleware verifies the JWT and re-validates role against the DB on each request. `authorize` middleware enforces role gates. |
| Access control | Roles, permissions, privileged access and approval model. | Roles: teamMember (own declarations only), approver (Line Manager / Head of HR / Group CEO), admin (full access). Department scoping for Line Managers. Workflow steps assigned to specific users; self-approval and step-order enforcement built in. |
| Audit logging | Audit events captured, retention, access and reporting. | Workflow instances retain full step history (decision, notes, decidedAt, decidedById, decidedByName). Approval transactions are atomic. Access and audit reporting to be confirmed for production. |
| Monitoring | Dashboards, metrics, alerts, thresholds and owners. | Health check endpoint (`/api/health`). Backend console logging for errors. Additional monitoring, metrics and alerting to be implemented for production. |
| Reporting | Operational reports, frequency, recipients and source of truth. | Source of Truth: PostgreSQL database (declarations + workflow instances). Reports: status breakdown, SLA breakdown, high-value declarations, counterparty concentration and Excel exports. Restricted to admin/approver roles. |
| Testing | Test approach, test cases, regression scope, defects and known limitations. | Approach: 360 backend unit/integration tests (Vitest), 15 frontend unit/component test files (Vitest), 16 Playwright E2E tests written but not yet passing (in progress). Coverage: approval workflow paths, department scoping, role isolation, file upload/download, reports, exports, auth. Known limitation: deleting a declaration orphans file records (no cascade). |
| Deployment | Deployment steps, release notes, rollback plan and change window needs. | Deployment steps: 1. Build and push backend image. 2. Build and push frontend image. 3. Run `docker compose up -d --build`. 4. Run Prisma schema push / migrations. 5. Seed data. 6. Verify `/api/health` and frontend login. Rollback: revert to previous image / git commit. Change window: outside reporting/audit peaks. |
| Support | Support owner, escalation path, SOP and Knowledge Base links. | Support Owner: Hollywoodbets Group Compliance / Application owner. Level 1: Application Support. Level 2: System Administrator. Level 3: Solution Developer. Documentation: README.md, docs/SECURITY.md, AGENTS.md, QA-Questionnaire.md. |
| Risks / decisions | Known risks, open decisions, assumptions and dependencies. | Known risks: orphaned file records on declaration delete; JWT expires requiring re-login; department-scoping correctness across roles. Open decisions: production CI/CD, structured monitoring/alerting, data retention/archiving policy, formal branching strategy. Assumptions: PostgreSQL availability, Docker host availability. Dependencies: Node.js, Docker, PostgreSQL, Prisma. |
