-- The ordinary unique constraint already enforces scoped names for every
-- non-null organizationId. PostgreSQL UNIQUE semantics allow repeated NULLs,
-- so the partial index adds no behavior and only adds write/storage cost.
DROP INDEX IF EXISTS public."Counterparty_name_org_unique";
