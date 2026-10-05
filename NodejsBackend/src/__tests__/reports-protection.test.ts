import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { execFileSync } from "child_process";
import * as XLSX from "xlsx";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";
import {
  detectKind,
  isProtectionAvailable,
  protectDocumentBytes,
  validateExportPassword,
} from "../services/documentProtection";

const app = buildApp();

// Minimal one-page PDF (parseable by pypdf).
const MINIMAL_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n" +
    "xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000056 00000 n \n0000000111 00000 n \n" +
    "trailer<</Size 4/Root 1 0 R>>\nstartxref\n168\n%%EOF",
  "ascii",
);

function buildXlsxBytes(): Buffer {
  const ws = XLSX.utils.json_to_sheet([{ a: 1, b: "x" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Report");
  return Buffer.from(XLSX.write(wb, { bookType: "xlsx", type: "buffer" }));
}

function pythonBin(): string {
  if (process.env.GHE_PYTHON_BIN) return process.env.GHE_PYTHON_BIN;
  try {
    execFileSync("python3", ["--version"], { stdio: "pipe" });
    return "python3";
  } catch {
    return "python";
  }
}

/** Run a verification snippet with the given bytes on stdin. */
function verifyStdin(script: string, data: Buffer): string {
  return execFileSync(pythonBin(), ["-c", script], { input: data, stdio: "pipe" }).toString();
}

let pdfAvailable = false;
let xlsxAvailable = false;

beforeAll(async () => {
  pdfAvailable = await isProtectionAvailable("pdf");
  xlsxAvailable = await isProtectionAvailable("xlsx");
});

describe("documentProtection unit behavior", () => {
  it("detects PDF and OOXML magic bytes", () => {
    expect(detectKind(MINIMAL_PDF)).toBe("pdf");
    expect(detectKind(buildXlsxBytes())).toBe("xlsx");
    expect(detectKind(Buffer.from("just text"))).toBeNull();
    expect(detectKind(Buffer.alloc(0))).toBeNull();
  });

  it("validates export passwords", () => {
    expect(validateExportPassword(undefined)).toMatch(/required/);
    expect(validateExportPassword("short")).toMatch(/at least 8/);
    expect(validateExportPassword("long-enough-password")).toBeNull();
    expect(validateExportPassword("x".repeat(129))).toMatch(/at most/);
  });
});

describe("POST /api/reports/protect-document", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app)
      .post("/api/reports/protect-document")
      .field("password", "long-enough-password")
      .attach("file", MINIMAL_PDF, { filename: "r.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(401);
  });

  it("rejects missing/short passwords", async () => {
    for (const pw of ["", "short"]) {
      const res = await request(app)
        .post("/api/reports/protect-document")
        .set("Authorization", `Bearer ${getTeamToken()}`)
        .field("password", pw)
        .attach("file", MINIMAL_PDF, { filename: "r.pdf", contentType: "application/pdf" });
      expect(res.status).toBe(400);
    }
    const missing = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .attach("file", MINIMAL_PDF, { filename: "r.pdf", contentType: "application/pdf" });
    expect(missing.status).toBe(400);
  });

  it("rejects non-PDF/non-Excel bytes with 415", async () => {
    const res = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("password", "long-enough-password")
      .attach("file", Buffer.from("just some text, not a document"), {
        filename: "r.txt",
        contentType: "text/plain",
      });
    expect(res.status).toBe(415);
  });

  it("team members may protect their own exports", async () => {
    const res = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .field("password", "long-enough-password")
      .attach("file", MINIMAL_PDF, { filename: "r.pdf", contentType: "application/pdf" });
    // Either real protection or the explicit unavailable contract.
    expect([200, 503]).toContain(res.status);
  });

  it("returns protected PDF bytes with download headers", async () => {
    const res = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .field("password", "s3cret-download-pw")
      .field("filename", "report.pdf")
      .attach("file", MINIMAL_PDF, { filename: "report.pdf", contentType: "application/pdf" });
    if (!pdfAvailable) {
      console.warn("SKIP real PDF download headers: sidecars unavailable (503 contract asserted instead).");
      expect(res.status).toBe(503);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["content-disposition"]).toContain("protected-report.pdf");
    expect(Number(res.headers["content-length"])).toBeGreaterThan(0);
  });

  it("returns protected workbook bytes with download headers", async () => {
    const res = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .field("password", "s3cret-download-pw")
      .field("filename", "report.xlsx")
      .attach("file", buildXlsxBytes(), {
        filename: "report.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
    if (!xlsxAvailable) {
      console.warn("SKIP real workbook download headers: sidecars unavailable (503 contract asserted instead).");
      expect(res.status).toBe(503);
      return;
    }
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml.sheet");
    expect(res.headers["content-disposition"]).toContain("protected-report.xlsx");
  });

  it("never returns the input bytes on encryption failure", async () => {
    if (!pdfAvailable) {
      console.warn("SKIP corrupt-PDF encryption failure: sidecars unavailable.");
      return;
    }
    // Valid magic, corrupt body: pypdf cannot parse it.
    const corrupt = Buffer.concat([Buffer.from("%PDF-"), Buffer.from("definitely not a pdf body")]);
    const res = await request(app)
      .post("/api/reports/protect-document")
      .set("Authorization", `Bearer ${getAdminToken()}`)
      .field("password", "long-enough-password")
      .attach("file", corrupt, { filename: "r.pdf", contentType: "application/pdf" });
    expect(res.status).toBe(502);
    expect(res.headers["content-type"]).toContain("application/json");
  });
});

describe("protectDocumentBytes round-trips (sidecars required)", () => {
  it("encrypts PDFs so they open only with the password", async () => {
    if (!pdfAvailable) {
      console.warn("SKIP real PDF round-trip: sidecars unavailable.");
      return;
    }
    const out = await protectDocumentBytes("pdf", MINIMAL_PDF, "s3cret-download-pw");
    expect(out.equals(MINIMAL_PDF)).toBe(false);
    const result = verifyStdin(
      "import sys;" +
        "from pypdf import PdfReader;" +
        "data = sys.stdin.buffer.read();" +
        "import tempfile, os;" +
        "p = os.path.join(tempfile.gettempdir(), 'ghe-pv.pdf');" +
        "open(p, 'wb').write(data);" +
        "r = PdfReader(p);" +
        "assert r.is_encrypted, 'output is not encrypted';" +
        "assert r.decrypt('wrong-password') == 0, 'opened without the password';" +
        "r2 = PdfReader(p, password='s3cret-download-pw');" +
        "assert len(r2.pages) == 1, 'password open failed';" +
        "print('PDF-VERIFY-OK')",
      out,
    );
    expect(result).toContain("PDF-VERIFY-OK");
  });

  it("encrypts workbooks so they open only with the password", async () => {
    if (!xlsxAvailable) {
      console.warn("SKIP real workbook round-trip: sidecars unavailable.");
      return;
    }
    const input = buildXlsxBytes();
    const out = await protectDocumentBytes("xlsx", input, "s3cret-download-pw");
    expect(out.equals(input)).toBe(false);
    const result = verifyStdin(
      "import sys;" +
        "import io, tempfile, os;" +
        "import msoffcrypto;" +
        "data = sys.stdin.buffer.read();" +
        "p = os.path.join(tempfile.gettempdir(), 'ghe-xv.xlsx');" +
        "open(p, 'wb').write(data);" +
        "f = msoffcrypto.OfficeFile(open(p, 'rb'));" +
        "assert f.is_encrypted(), 'output is not encrypted';" +
        "f.load_key(password='s3cret-download-pw'); out = io.BytesIO(); f.decrypt(out);" +
        "assert out.getvalue()[:2] == b'PK', 'password decrypt failed';" +
        "print('XLSX-VERIFY-OK')",
      out,
    );
    expect(result).toContain("XLSX-VERIFY-OK");
  });

  it("rejects loudly when tooling is unavailable", async () => {
    const prev = process.env.GHE_PYTHON_BIN;
    process.env.GHE_PYTHON_BIN = "definitely-not-a-python-binary";
    try {
      await expect(protectDocumentBytes("pdf", MINIMAL_PDF, "long-enough-password")).rejects.toThrow(
        /unavailable/,
      );
    } finally {
      if (prev === undefined) delete process.env.GHE_PYTHON_BIN;
      else process.env.GHE_PYTHON_BIN = prev;
    }
  });
});
