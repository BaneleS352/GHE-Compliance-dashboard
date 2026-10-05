import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Password protection for explicitly exported documents (Phase 5).
 *
 * Encryption itself runs in a short-lived Python helper
 * (`scripts/protect_document.py`) using maintained pure-Python libraries
 * (pypdf AES-256 for PDF, msoffcrypto ECMA-376 for OOXML). The downloader
 * sets the password per export in the UI; it travels in the POST body only,
 * is passed to the helper via environment (never argv/logs), and is never
 * stored. Unprotected bytes are never persisted — temp files live under the
 * OS temp dir with random names and are unlinked in a finally block.
 */

export type ProtectableKind = "pdf" | "xlsx";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const SIDECAR_TIMEOUT_MS = 60_000;

function pythonCandidates(): string[] {
  const fromEnv = process.env.GHE_PYTHON_BIN;
  const rest = fromEnv ? [] : ["python3", "python"];
  return [...(fromEnv ? [fromEnv] : []), ...rest];
}

let resolvedPython: { env: string | undefined; value: string | null } | undefined;

async function commandOk(cmd: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 30_000 }, (err) => resolve(!err));
  });
}

async function resolvePython(): Promise<string | null> {
  const envBin = process.env.GHE_PYTHON_BIN;
  if (resolvedPython !== undefined && resolvedPython.env === envBin) return resolvedPython.value;
  for (const candidate of pythonCandidates()) {
    if (await commandOk(candidate, ["--version"])) {
      resolvedPython = { env: envBin, value: candidate };
      return candidate;
    }
  }
  resolvedPython = { env: envBin, value: null };
  return null;
}

/** True when the helper interpreter and the library for `kind` are usable. */
export async function isProtectionAvailable(kind: ProtectableKind): Promise<boolean> {
  const py = await resolvePython();
  if (!py) return false;
  const lib = kind === "pdf" ? "pypdf" : "msoffcrypto";
  return commandOk(py, ["-c", `import ${lib}`]);
}

export function validateExportPassword(password: unknown): string | null {
  if (typeof password !== "string") return "A password is required to download a protected export.";
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters.`;
  return null;
}

/** Detect kind from magic bytes: %PDF- or PK\x03\x04 (OOXML). Null when unknown. */
export function detectKind(bytes: Buffer): ProtectableKind | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  ) {
    return "xlsx";
  }
  return null;
}

/** Encrypt `input` and return the protected bytes. Rejects loudly on any failure. */
export async function protectDocumentBytes(
  kind: ProtectableKind,
  input: Buffer,
  password: string,
): Promise<Buffer> {
  if (!(await isProtectionAvailable(kind))) {
    throw Object.assign(
      new Error(
        "Document protection is unavailable on this server (encryption libraries not installed). No unprotected copy was produced.",
      ),
      { statusCode: 503 },
    );
  }
  const python = (await resolvePython()) as string;
  const tag = randomBytes(8).toString("hex");
  const inPath = join(tmpdir(), `ghe-protect-in-${tag}`);
  const outPath = join(tmpdir(), `ghe-protect-out-${tag}`);
  try {
    await fs.writeFile(inPath, input, { mode: 0o600 });
    const script = join(__dirname, "..", "scripts", "protect_document.py");
    await new Promise<void>((resolve, reject) => {
      execFile(
        python,
        [script, inPath, outPath, kind],
        {
          timeout: SIDECAR_TIMEOUT_MS,
          env: { ...process.env, GHE_DOC_PASSWORD: password },
          windowsHide: true,
        },
        (err, _stdout, stderr) => {
          if (err) {
            const detail = String(stderr || "").slice(0, 300) || err.message;
            reject(
              Object.assign(new Error(`Document encryption failed: ${detail}`), {
                statusCode: 502,
              }),
            );
            return;
          }
          resolve();
        },
      );
    });
    return await fs.readFile(outPath);
  } finally {
    await fs.unlink(inPath).catch(() => undefined);
    await fs.unlink(outPath).catch(() => undefined);
  }
}
