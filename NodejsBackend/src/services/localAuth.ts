import { randomInt, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);
const PASSWORD_KEY_LENGTH = 64;
const OTP_TTL_MS = 5 * 60 * 1000;

export interface OtpMessage {
  destination: string;
  code: string;
  expiresAt: Date;
}

export interface OtpTransport {
  send(message: OtpMessage): Promise<void>;
}

export class LocalOtpInbox implements OtpTransport {
  readonly messages: OtpMessage[] = [];

  async send(message: OtpMessage): Promise<void> {
    this.messages.push(message);
  }
}

export async function hashLocalPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) throw new Error("Password must be between 12 and 128 characters");
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, PASSWORD_KEY_LENGTH) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyLocalPassword(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltValue, hashValue] = encoded.split("$");
  if (scheme !== "scrypt" || !saltValue || !hashValue) return false;
  try {
    const expected = Buffer.from(hashValue, "base64url");
    const actual = await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length) as Buffer;
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createOtp(): { code: string; expiresAt: Date } {
  return { code: String(randomInt(100000, 1000000)), expiresAt: new Date(Date.now() + OTP_TTL_MS) };
}
