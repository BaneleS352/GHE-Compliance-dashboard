/**
 * Test authentication seam (OpenID Phase 5): unit tests never issue
 * production credentials. Tokens are RS256 JWTs signed with the run's
 * throwaway test key (see `src/test-utils/test-jwks-server.ts`), carrying
 * Entra-shaped claims (`oid`, email, name). The backend resolves the local
 * user by email exactly like production.
 *
 * Helper signatures intentionally match the old HS256 helpers so call sites
 * (`Bearer ${getAdminToken()}`) keep working unchanged.
 */
import fs from "fs";
import { signTestJwt, testKeyMaterialPath, type MintClaims, type TestKeyMaterial } from "../test-utils/test-jwks-server";

let material: TestKeyMaterial | null = null;

function getMaterial(): TestKeyMaterial {
  if (!material) {
    const raw = fs.readFileSync(testKeyMaterialPath(), "utf8");
    material = JSON.parse(raw) as TestKeyMaterial;
  }
  return material;
}

/** Sign an RS256 test token. `claims` overrides email/name/oid for negative tests. */
export function testToken(claims: MintClaims & { email: string }): string {
  return signTestJwt(getMaterial(), claims);
}

function userToken(oid: string, email: string, name: string): string {
  return testToken({ oid, email, name });
}

// Numeric fixture ids shared with globalSetup.ts (1 = admin, 2 = approver,
// 3 = HR, 4 = team member). Identity comes from the local user row, exactly
// like production — tokens carry no role or id.
export function getAdminToken(): string {
  return userToken("test-oid-admin", "admin@test.com", "Admin User");
}

export function getApproverToken(): string {
  return userToken("test-oid-sipho", "sipho@test.com", "Sipho Approver");
}

export function getTeamToken(): string {
  return userToken("test-oid-nomvula", "nomvula@test.com", "Nomvula Team");
}

export function getHrToken(): string {
  return userToken("test-oid-lindiwe", "lindiwe@test.com", "Lindiwe HR");
}

export function getKabeloToken(): string {
  return userToken("test-oid-kabelo", "kabelo@npn.co.za", "Kabelo Molefe");
}

export function getJamesToken(): string {
  return userToken("test-oid-james", "james@npn.co.za", "James van Wyk");
}
