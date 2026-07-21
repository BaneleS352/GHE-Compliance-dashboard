import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "GHE Compliance Dashboard API",
      version: "1.0.0",
      description: "REST API for managing Gifts, Hospitality & Entertainment compliance declarations, workflow approvals, and reporting.",
      contact: { name: "GHE Team" },
    },
    servers: [{ url: "http://localhost:3001", description: "Development" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 1 } },
        },
        LoginResponse: {
          type: "object",
          properties: { token: { type: "string" }, user: { $ref: "#/components/schemas/User" } },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, email: { type: "string" },
            role: { type: "string", enum: ["admin", "approver", "teamMember"] },
            teamMemberNumber: { type: "string" }, department: { type: "string" },
            position: { type: "string" }, lineManager: { type: "string", nullable: true },
          },
        },
        DeclarationInput: {
          type: "object",
          required: ["employee", "employeeId", "department", "type", "counterparty", "value", "status"],
          properties: {
            employee: { type: "string" }, employeeId: { type: "string" },
            teamMemberNumber: { type: "string" }, lineManager: { type: "string" },
            position: { type: "string" }, department: { type: "string" },
            company: { type: "string" }, team: { type: "string" },
            type: { type: "string", description: "Gift | Hospitality | Entertainment" },
            counterparty: { type: "string" }, value: { type: "number", minimum: 0 },
            submitted: { type: "string" }, approver: { type: "string" },
            status: { type: "string", enum: ["Draft", "Pending", "Approved", "Declined", "Info Requested", "Escalated"] },
            priority: { type: "string", enum: ["Low", "Medium", "High"] },
            description: { type: "string" }, relationship: { type: "string" },
            receivedGiven: { type: "string" }, from: { type: "string" },
            contactPerson: { type: "string" }, biddingProcess: { type: "string" },
            contractNegotiation: { type: "string" }, occasion: { type: "string" },
            date: { type: "string" }, instances: { type: "string" },
            publicOfficial: { type: "string" }, substantiation: { type: "string" },
          },
        },
        Declaration: {
          allOf: [
            { $ref: "#/components/schemas/DeclarationInput" },
            { type: "object", properties: { id: { type: "string" }, createdAt: { type: "string" }, updatedAt: { type: "string" } } },
          ],
        },
        WorkflowStep: {
          type: "object",
          properties: {
            order: { type: "integer" }, role: { type: "string" }, assignee: { type: "string" },
            assigneeName: { type: "string" }, label: { type: "string" },
            status: { type: "string", enum: ["pending", "approved", "declined", "returned"] },
            decision: { type: "string", nullable: true }, notes: { type: "string" },
            decidedAt: { type: "string", nullable: true },
          },
        },
        WorkflowInstance: {
          type: "object",
          properties: { declarationId: { type: "string" }, steps: { type: "array", items: { $ref: "#/components/schemas/WorkflowStep" } } },
        },
        ApproveRequest: {
          type: "object",
          required: ["declarationId", "decision"],
          properties: {
            declarationId: { type: "string" },
            decision: { type: "string", enum: ["accept", "org", "foundation", "decline", "return", "reject", "info", "escalate"] },
            notes: { type: "string" },
          },
        },
        SystemConfig: {
          type: "object",
          properties: {
            highValueThreshold: { type: "number" }, mediumValueThreshold: { type: "number" },
            slaEscalationDays: { type: "integer" }, maxDeclarationsPerCounterparty: { type: "integer" },
            emailTemplate: { type: "string" },
          },
        },
        Dropdowns: {
          type: "object",
          properties: {
            departments: { type: "array", items: { type: "string" } },
            categories: { type: "array", items: { type: "string" } },
            occasions: { type: "array", items: { type: "string" } },
            receivedGiven: { type: "array", items: { type: "string" } },
            biddingProcess: { type: "array", items: { type: "string" } },
            publicOfficial: { type: "array", items: { type: "string" } },
            relationships: { type: "array", items: { type: "string" } },
            partyTypes: { type: "array", items: { type: "string" } },
          },
        },
        WorkflowRule: {
          type: "object",
          properties: {
            id: { type: "string" }, name: { type: "string" }, condition: { type: "string" },
            priority: { type: "integer" }, steps: { type: "string", description: "JSON array of step definitions" },
          },
        },
        DashboardKPIs: {
          type: "object",
          properties: {
            users: { type: "integer" }, declarations: { type: "integer" },
            workflows: { type: "integer" }, threshold: { type: "number" },
          },
        },
        Error: {
          type: "object",
          properties: { error: { type: "string" } },
        },
      },
    },
    paths: {
      // ── Auth ──────────────────────────────────────────────
      "/api/auth/preset-users": {
        get: {
          tags: ["Auth"],
          summary: "Get preset user list for login screen (no auth required)",
          responses: { 200: { description: "Array of { label, email, role } preset users" } },
        },
      },
      "/api/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Authenticate user",
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } } },
          responses: {
            200: { description: "Returns JWT token and user profile", content: { "application/json": { schema: { $ref: "#/components/schemas/LoginResponse" } } } },
            400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            401: { description: "Invalid email or password", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
      },
      "/api/auth/me": {
        get: {
          tags: ["Auth"],
          summary: "Get current user profile",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "User profile", content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } }, 401: { description: "Unauthorized" } },
        },
      },

      // ── Declarations ──────────────────────────────────────
      "/api/declarations": {
        get: {
          tags: ["Declarations"],
          summary: "List declarations",
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "status", schema: { type: "string" }, description: "Filter by status" },
            { in: "query", name: "search", schema: { type: "string" }, description: "Search by text" },
          ],
          responses: { 200: { description: "Array of declarations", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Declaration" } } } } } },
        },
        post: {
          tags: ["Declarations"],
          summary: "Create a new declaration",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/DeclarationInput" } } } },
          responses: { 201: { description: "Created declaration" }, 400: { description: "Validation error" } },
        },
        delete: {
          tags: ["Declarations"],
          summary: "DELETE without ID — not allowed",
          security: [{ bearerAuth: [] }],
          responses: { 404: { description: "Not found" } },
        },
      },
      "/api/declarations/stats": {
        get: {
          tags: ["Declarations"],
          summary: "Get declaration stats & KPIs",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Stats including KPIs, trend, and type breakdown" } },
        },
      },
      "/api/declarations/{id}": {
        get: {
          tags: ["Declarations"],
          summary: "Get declaration by ID with workflow steps",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Declaration with workflow steps" }, 404: { description: "Not found" } },
        },
        put: {
          tags: ["Declarations"],
          summary: "Update declaration (draft or info-requested only)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { type: "object", additionalProperties: true } } } },
          responses: { 200: { description: "Updated declaration" }, 400: { description: "Cannot update non-draft" } },
        },
        delete: {
          tags: ["Declarations"],
          summary: "Delete draft declaration",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deleted" }, 404: { description: "Not found" } },
        },
      },
      "/api/declarations/{id}/submit": {
        patch: {
          tags: ["Declarations"],
          summary: "Submit declaration — creates workflow steps, sets status to Pending",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Submitted — status now Pending" }, 400: { description: "Only drafts can be submitted" } },
        },
      },
      "/api/declarations/{id}/status": {
        patch: {
          tags: ["Declarations"],
          summary: "Directly update declaration status",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { status: { type: "string" } }, required: ["status"] } } } },
          responses: { 200: { description: "Status updated" } },
        },
      },

      // ── Workflows ─────────────────────────────────────────
      "/api/workflows/pending": {
        get: {
          tags: ["Workflows"],
          summary: "List pending approval steps for the current user",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Array of pending steps with declaration info" } },
        },
      },
      "/api/workflows/instances/{declarationId}": {
        get: {
          tags: ["Workflows"],
          summary: "Get workflow timeline for a declaration",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "declarationId", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Workflow instance with steps" } },
        },
      },
      "/api/workflows/approve": {
        post: {
          tags: ["Workflows"],
          summary: "Approve, decline, or return a workflow step",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/ApproveRequest" } } } },
          responses: {
            200: { description: "Step processed — returns newStatus and currentStep" },
            400: { description: "Invalid decision or no pending step" },
            403: { description: "Not authorized for this step" },
          },
        },
      },

      // ── Reports ───────────────────────────────────────────
      "/api/reports/status-breakdown": {
        get: {
          tags: ["Reports"],
          summary: "Declaration counts grouped by status",
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "startDate", schema: { type: "string" } },
            { in: "query", name: "endDate", schema: { type: "string" } },
            { in: "query", name: "department", schema: { type: "string" } },
            { in: "query", name: "status", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Status-wise counts" } },
        },
      },
      "/api/reports/sla": {
        get: {
          tags: ["Reports"],
          summary: "SLA turnaround times by role",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Avg/min/max days per role" } },
        },
      },
      "/api/reports/counterparty-concentration": {
        get: {
          tags: ["Reports"],
          summary: "Declarations grouped by counterparty",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Counterparty-wise totals sorted descending" } },
        },
      },
      "/api/reports/high-value": {
        get: {
          tags: ["Reports"],
          summary: "Declarations above high-value threshold",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "High-value declarations" } },
        },
      },
      "/api/reports/list": {
        get: {
          tags: ["Reports"],
          summary: "Filtered declaration list for result tables",
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "startDate", schema: { type: "string" } },
            { in: "query", name: "endDate", schema: { type: "string" } },
            { in: "query", name: "department", schema: { type: "string" } },
            { in: "query", name: "status", schema: { type: "string" } },
          ],
          responses: { 200: { description: "Filtered declaration array" } },
        },
      },
      "/api/reports/export": {
        get: {
          tags: ["Reports"],
          summary: "Export declarations as XLSX spreadsheet",
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "reportType", schema: { type: "string" }, description: "Title for the report" },
            { in: "query", name: "startDate", schema: { type: "string" } },
            { in: "query", name: "endDate", schema: { type: "string" } },
            { in: "query", name: "department", schema: { type: "string" } },
            { in: "query", name: "status", schema: { type: "string" } },
          ],
          responses: { 200: { description: "XLSX file download", content: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": {} } } },
        },
      },

      // ── Files ─────────────────────────────────────────────
      "/api/files/upload": {
        post: {
          tags: ["Files"],
          summary: "Upload a file (max 10MB)",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, declarationId: { type: "string" } } } } } },
          responses: { 200: { description: "Uploaded file metadata" } },
        },
      },
      "/api/files/{id}": {
        get: {
          tags: ["Files"],
          summary: "Download a file by ID",
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "File stream" }, 404: { description: "Not found" } },
        },
        delete: {
          tags: ["Files"],
          summary: "Delete a file",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deleted" } },
        },
      },

      // ── Admin Dashboard ───────────────────────────────────
      "/api/admin/dashboard": {
        get: {
          tags: ["Admin - Dashboard"],
          summary: "KPI counts (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Dashboard KPIs", content: { "application/json": { schema: { $ref: "#/components/schemas/DashboardKPIs" } } } }, 403: { description: "Forbidden" } },
        },
      },

      // ── Admin Users ───────────────────────────────────────
      "/api/admin/users": {
        get: {
          tags: ["Admin - Users"],
          summary: "List all users (admin only)",
          security: [{ bearerAuth: [] }],
          parameters: [
            { in: "query", name: "search", schema: { type: "string" } },
            { in: "query", name: "role", schema: { type: "string" } },
          ],
          responses: { 200: { description: "User array" } },
        },
        post: {
          tags: ["Admin - Users"],
          summary: "Create a new user (admin only)",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" }, email: { type: "string" }, role: { type: "string" }, department: { type: "string" }, position: { type: "string" }, teamMemberNumber: { type: "string" }, lineManager: { type: "string" } }, required: ["name", "email", "role", "department", "position"] } } } },
          responses: { 201: { description: "Created user" }, 409: { description: "Duplicate email" } },
        },
      },
      "/api/admin/users/{id}": {
        get: {
          tags: ["Admin - Users"],
          summary: "Get user by ID (admin only)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "User object" }, 404: { description: "Not found" } },
        },
        put: {
          tags: ["Admin - Users"],
          summary: "Update user (admin only)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { type: "object" } } } },
          responses: { 200: { description: "Updated user" } },
        },
        delete: {
          tags: ["Admin - Users"],
          summary: "Delete user (admin only — blocks deleting last admin)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deleted" }, 400: { description: "Cannot delete last admin" } },
        },
      },

      // ── Admin Config ──────────────────────────────────────
      "/api/admin/config": {
        get: {
          tags: ["Admin - Config"],
          summary: "Get system config (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "System config", content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } } } },
        },
        put: {
          tags: ["Admin - Config"],
          summary: "Update system config (admin only)",
          security: [{ bearerAuth: [] }],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/SystemConfig" } } } },
          responses: { 200: { description: "Updated config" }, 400: { description: "Validation error" } },
        },
      },
      "/api/admin/config/dropdowns": {
        get: {
          tags: ["Admin - Config"],
          summary: "Get dropdown options (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Dropdown options", content: { "application/json": { schema: { $ref: "#/components/schemas/Dropdowns" } } } } },
        },
        put: {
          tags: ["Admin - Config"],
          summary: "Update dropdown options (admin only)",
          security: [{ bearerAuth: [] }],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/Dropdowns" } } } },
          responses: { 200: { description: "Updated dropdowns" }, 400: { description: "Empty array rejected" } },
        },
      },
      "/api/admin/config/approval-options": {
        get: {
          tags: ["Admin - Config"],
          summary: "Get approval decision options (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Approval options array" } },
        },
      },

      // ── Admin Workflow Rules ──────────────────────────────
      "/api/admin/workflows/rules": {
        get: {
          tags: ["Admin - Workflows"],
          summary: "List all workflow rules (admin only)",
          security: [{ bearerAuth: [] }],
          responses: { 200: { description: "Workflow rules sorted by priority" } },
        },
        post: {
          tags: ["Admin - Workflows"],
          summary: "Create a workflow rule (admin only)",
          security: [{ bearerAuth: [] }],
          requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/WorkflowRule" } } } },
          responses: { 201: { description: "Created rule" } },
        },
      },
      "/api/admin/workflows/rules/{id}": {
        put: {
          tags: ["Admin - Workflows"],
          summary: "Update a workflow rule (admin only)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/WorkflowRule" } } } },
          responses: { 200: { description: "Updated rule" } },
        },
        delete: {
          tags: ["Admin - Workflows"],
          summary: "Delete a workflow rule (admin only)",
          security: [{ bearerAuth: [] }],
          parameters: [{ in: "path", name: "id", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Deleted" } },
        },
      },

      // ── Health ────────────────────────────────────────────
      "/api/health": {
        get: {
          tags: ["Health"],
          summary: "Health check",
          responses: { 200: { description: "OK with timestamp" } },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
