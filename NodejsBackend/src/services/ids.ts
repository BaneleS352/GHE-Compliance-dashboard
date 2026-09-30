/**
 * Numeric identifier boundary helpers (Identifier Strategy cutover).
 *
 * All internal primary/foreign keys are PostgreSQL BIGINT. Prisma surfaces
 * them as JS `bigint`, which JSON.stringify cannot serialize, so every API
 * boundary converts to JSON-safe Numbers via `toJsonId`. Inbound values
 * (route params, JWT claims, payloads) normalize via `toDbId`.
 */

/** Prisma BIGINT value -> JSON-safe number. Throws beyond MAX_SAFE_INTEGER. */
export function toJsonId(id: bigint | number): number {
  const n = typeof id === "bigint" ? Number(id) : id;
  if (!Number.isSafeInteger(n)) throw new Error(`Identifier ${String(id)} exceeds the JSON-safe integer range`);
  return n;
}

/** Inbound identifier (param, JWT claim, payload) -> Prisma BIGINT value. */
export function toDbId(id: number | bigint | string): bigint {
  if (typeof id === "bigint") return id;
  if (typeof id === "number") {
    if (!Number.isInteger(id)) throw new Error(`Invalid identifier: ${id}`);
    return BigInt(id);
  }
  const s = String(id).trim();
  if (!/^-?\d+$/.test(s)) throw new Error(`Invalid identifier: ${id}`);
  return BigInt(s);
}

/** Route-param parser: returns null (caller sends 400/404) instead of throwing. */
export function parseIdParam(raw: unknown): bigint | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number" && Number.isInteger(raw)) return BigInt(raw);
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return BigInt(raw.trim());
  return null;
}
