import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT, type JWK, type JWTPayload } from "jose";

type GeneratedKeyPair = Awaited<ReturnType<typeof generateKeyPair>>;
let privateKey: GeneratedKeyPair["privateKey"] | null = null;
let publicJwk: JWK | null = null;
const kid = "ghe-local-dev-1";

export async function initializeLocalIdentity(): Promise<void> {
  if (privateKey) return;
  const pair = await generateKeyPair("RS256", { modulusLength: 2048 });
  privateKey = pair.privateKey;
  publicJwk = { ...(await exportJWK(pair.publicKey)), kid, alg: "RS256", use: "sig" };
}

export async function localJwks(): Promise<{ keys: JWK[] }> {
  await initializeLocalIdentity();
  return { keys: [publicJwk!] };
}

export async function signLocalAccessToken(input: { subject: string; email: string; name: string; role: string }): Promise<string> {
  await initializeLocalIdentity();
  return new SignJWT({
    oid: input.subject,
    email: input.email,
    name: input.name,
    azp: "ghe-local-spa",
    scp: "access_as_user",
  }).setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuer("ghe-local")
    .setAudience("ghe-local-api")
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(privateKey!);
}

export async function verifyLocalAccessToken(token: string): Promise<JWTPayload> {
  await initializeLocalIdentity();
  const key = await importJWK(publicJwk!, "RS256");
  const result = await jwtVerify(token, key, { issuer: "ghe-local", audience: "ghe-local-api", algorithms: ["RS256"] });
  return result.payload;
}
