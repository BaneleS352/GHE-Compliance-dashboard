/**
 * TEST-ONLY authentication seam for the Entra cutover (never imported by
 * runtime code — enforced by the forbidden-refs CI check).
 *
 * The backend validates RS256 bearer tokens against a remote JWKS document.
 * Real Entra tenants are unavailable in tests/CI/e2e, so this module boots a
 * throwaway local "provider": it generates a fresh RSA-2048 keypair per run,
 * serves the public JWKS, and mints controlled RS256 (or deliberately wrong)
 * tokens. Nothing here is a production fallback: production points
 * OIDC_AUTHORITY at the real tenant, and these helpers only run inside test,
 * smoke, and e2e harnesses.
 *
 * Consumers:
 * - backend `globalSetup.ts` boots the server and points OIDC_* at it;
 * - backend unit tests sign synchronously via `signTestJwt` (key material is
 *   written to a 0600 temp file by globalSetup — no secrets in the repo);
 * - smoke scripts and Playwright e2e mint over HTTP (`POST /test-token`).
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createPrivateKey, createSign, createHmac, generateKeyPairSync, randomUUID, type JsonWebKey } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const TEST_JWKS_PORT = Number(process.env.TEST_JWKS_PORT || 55439);
export const TEST_AUDIENCE = "ghe-test-api-audience";

export interface TestKeyMaterial {
  kid: string;
  /** Private key in JWK format (test-only, per-run, never committed). */
  privateJwk: JsonWebKey;
  publicJwks: { keys: Record<string, unknown>[] };
  issuer: string;
  audience: string;
}

export function testKeyMaterialPath(): string {
  const tag = process.env.PG_TEST_PORT || "55433";
  return join(tmpdir(), `ghe-test-jwks-${tag}.json`);
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function makeKeyMaterial(issuer: string): TestKeyMaterial {
  const kp = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const kid = randomUUID();
  const privateJwk = kp.privateKey.export({ format: "jwk" });
  const publicJwk = {
    ...(kp.publicKey.export({ format: "jwk" }) as unknown as Record<string, unknown>),
    kid,
    alg: "RS256",
    use: "sig",
  };
  return { kid, privateJwk, publicJwks: { keys: [publicJwk] }, issuer, audience: TEST_AUDIENCE };
}

export interface MintClaims {
  oid?: string;
  email?: string;
  name?: string;
  /** Override issuer (default: test issuer). */
  iss?: string;
  /** Override audience (default: test audience). */
  aud?: string | string[];
  /** Seconds from now for `exp` (default 3600; negative = expired). */
  expOffsetSec?: number;
  /** Sign with HS256 instead of RS256 (negative test). */
  algHS256?: boolean;
  /** Omit the `oid` claim (negative test). */
  noOid?: boolean;
}

/** Synchronously sign a test token with the run's test key (unit-test path). */
export function signTestJwt(material: TestKeyMaterial, claims: MintClaims = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: claims.algHS256 ? "HS256" : "RS256", typ: "JWT", kid: material.kid };
  const payload: Record<string, unknown> = {
    iss: claims.iss ?? material.issuer,
    aud: claims.aud ?? material.audience,
    iat: now,
    exp: now + (claims.expOffsetSec ?? 3600),
    name: claims.name ?? "Test User",
  };
  if (!claims.noOid) payload.oid = claims.oid ?? `test-oid-${(claims.email ?? "user").replace(/[^a-z0-9]/gi, "-")}`;
  if (claims.email !== undefined) payload.email = claims.email;
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  let signature: Buffer;
  if (claims.algHS256) {
    signature = createHmac("sha256", "test-hs256-secret").update(signingInput).digest();
  } else {
    const key = createPrivateKey({ key: material.privateJwk, format: "jwk" });
    signature = createSign("RSA-SHA256").update(signingInput).sign(key);
  }
  return `${signingInput}.${b64url(signature)}`;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? (JSON.parse(raw) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/** Boot the throwaway provider. Caller must `close()` it (globalSetup teardown). */
export async function startTestJwksServer(port = TEST_JWKS_PORT): Promise<{
  baseUrl: string;
  material: TestKeyMaterial;
  close: () => Promise<void>;
}> {
  const issuer = `http://127.0.0.1:${port}`;
  const material = makeKeyMaterial(issuer);
  const server: Server = createServer(async (req, res: ServerResponse) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/discovery/v2.0/keys") {
      res.setHeader("content-type", "application/json");
      res.setHeader("cache-control", "no-store");
      res.end(JSON.stringify(material.publicJwks));
      return;
    }
    if (req.method === "POST" && url.pathname === "/test-token") {
      const body = await readBody(req);
      const token = signTestJwt(material, {
        oid: typeof body.oid === "string" ? body.oid : undefined,
        email: typeof body.email === "string" ? body.email : undefined,
        name: typeof body.name === "string" ? body.name : undefined,
        iss: typeof body.iss === "string" ? body.iss : undefined,
        aud: typeof body.aud === "string" ? body.aud : undefined,
        expOffsetSec: typeof body.expOffsetSec === "number" ? body.expOffsetSec : undefined,
        algHS256: body.algHS256 === true,
        noOid: body.noOid === true,
      });
      res.setHeader("content-type", "text/plain");
      res.end(token);
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", (err: unknown) => {
      const code = (err as { code?: string }).code;
      if (code === "EADDRINUSE") resolve(); // Orphaned run left it up; reuse.
      else reject(err);
    });
    server.listen(port, "127.0.0.1", () => resolve());
  });
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    material,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
