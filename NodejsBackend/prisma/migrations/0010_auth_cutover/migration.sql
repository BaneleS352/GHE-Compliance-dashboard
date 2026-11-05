-- 0010_auth_cutover: remove local password storage, add provider identity link.
--
-- Authentication moves to Microsoft Entra ID (OpenID Connect). Local
-- password hashes are deleted with the column — credentials are
-- provider-managed from here on; existing local rows must be linked to a
-- provider subject through the audited admin operation before sign-in
-- (see docs/IDENTITY-CONTRACT.md).
--
-- providerSubject is globally UNIQUE: one provider identity links to at
-- most one local user, which makes account-mismatch (subject changed for a
-- known email) fail closed instead of silently re-linking.

ALTER TABLE "User" DROP COLUMN "passwordHash";

ALTER TABLE "User" ADD COLUMN "providerSubject" TEXT;
ALTER TABLE "User" ADD COLUMN "providerIssuer" TEXT;
CREATE UNIQUE INDEX "User_providerSubject_key" ON "User"("providerSubject");
CREATE INDEX "User_providerIssuer_idx" ON "User"("providerIssuer");
