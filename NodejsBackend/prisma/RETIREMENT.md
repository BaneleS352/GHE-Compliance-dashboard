# Phase 5 compatibility retirement runbook

Legacy JSON/text columns are currently **write-through caches**: every read
prefers the relational tables (`WorkflowInstanceStep`, `WorkflowRuleStep`,
`DeclarationSnapshot`, `DeclarationDetail`, `DeclarationFile`,
`Counterparty`), with the legacy columns as fallback. The API contract is
unchanged.

Destructive column removal must happen in a **later release** than the one
that introduced the relational tables, and only after all of these gates:

## Gates (all required)

1. `npm run db:verify` passes on a representative production backup
   (zero drift between relational rows and legacy columns).
2. One full release window has run in production with the source-of-truth
   flip (relational reads) and no drift reported.
3. A tested backup/restore rollback plan exists. Rollback is
   backup/restore — DDL in this migration is not reversible by design.

## Deferred DDL (draft — do NOT place under `migrations/` until gates pass)

Placing these files under `prisma/migrations/` would apply them on the next
`prisma migrate deploy`. Keep this draft here until the release is approved.

```sql
-- 0002_retirement (DRAFT — requires gates above + separate approval)
ALTER TABLE "WorkflowInstance" DROP COLUMN IF EXISTS "steps";
ALTER TABLE "WorkflowRule" DROP COLUMN IF EXISTS "steps";
-- Declaration.files stays until the file-metadata API change is approved
-- separately (clients still POST `files` arrays; see routes/declarations.ts).
-- Declaration employee-context strings (employee, department, ...) stay:
-- they are canonical transactional data and the API contract, while
-- DeclarationSnapshot is the immutable history record.
```

## After applying

- Remove the JSON-fallback branches (`safeParseSteps` fallbacks,
  `readWorkflowSteps` legacy path, rule-JSON parsing) in a follow-up commit.
- Any API response-shape simplification is a separately approved versioned
  change — do not bundle it with this migration.
