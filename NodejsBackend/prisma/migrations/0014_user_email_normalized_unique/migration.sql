-- 0014_user_email_normalized_unique
-- User email is globally unique by product policy and application writes are
-- lower-cased. Enforce that normalization for direct SQL/seed/import writers
-- as well so case/space variants cannot bypass uniqueness.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "User"
    GROUP BY lower(btrim("email"))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION '0014 blocked: duplicate normalized user emails exist; resolve them before applying the normalized unique index';
  END IF;
END $$;

CREATE UNIQUE INDEX "User_email_normalized_key"
  ON "User" (lower(btrim("email")));
