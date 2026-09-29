-- Replace the legacy text-date monthly reporting view with the canonical
-- eventDate definition (Phase 1 timestamp cutover).
--
-- 0001_normalization defined "v_declarations_monthly" from the legacy
-- "Declaration"."date" text column via substr(). That migration is already
-- deployed and is not edited. This forward migration owns the typed
-- definition: month buckets derive from the "eventDate" DATE column.
--
-- Rows with a NULL eventDate (invalid legacy text that the backfill could not
-- parse) cannot be bucketed and are excluded; they are counted in the
-- backfill reconciliation report as invalidDates. No transactional data is
-- modified — this statement only replaces a read-model view.
CREATE OR REPLACE VIEW "v_declarations_monthly" AS
  SELECT "organizationId" AS "organizationId",
         to_char("eventDate", 'YYYY-MM') AS "month",
         COUNT(*) AS "count",
         SUM(CASE WHEN "status" = 'Approved' THEN 1 ELSE 0 END) AS "approved",
         SUM(CASE WHEN "status" = 'Declined' THEN 1 ELSE 0 END) AS "declined",
         SUM("value") AS "totalValue"
  FROM "Declaration" WHERE "eventDate" IS NOT NULL
  GROUP BY "organizationId", to_char("eventDate", 'YYYY-MM');
