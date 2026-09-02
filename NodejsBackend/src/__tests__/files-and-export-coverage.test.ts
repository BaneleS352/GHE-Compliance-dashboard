import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { buildApp, getAdminToken, getTeamToken } from "./helpers";
import { generateExcelBuffer } from "../services/excelService";

const app = buildApp();
const prisma = new PrismaClient();
const uploadDir = path.resolve(process.cwd(), "uploads");
let declarationId: string;
const createdFileIds: string[] = [];

describe("File and report export contracts", () => {
  beforeAll(async () => {
    const declaration = await prisma.declaration.findFirst({ where: { employeeId: "user-team" } });
    if (!declaration) throw new Error("Seed declaration for user-team is required");
    declarationId = declaration.id;
  });

  afterAll(async () => {
    for (const id of createdFileIds) {
      await prisma.uploadedFile.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  it("uploads and downloads an owned text file with attachment headers", async () => {
    const upload = await request(app)
      .post("/api/files/upload")
      .set("Authorization", `Bearer ${getTeamToken()}`)
      .attach("file", Buffer.from("receipt contents"), "receipt.txt")
      .field("declarationId", declarationId);
    expect(upload.status).toBe(201);
    createdFileIds.push(upload.body.id);
    expect(upload.body).toMatchObject({ name: "receipt.txt", type: "text/plain", url: `/api/files/${upload.body.id}` });

    const download = await request(app).get(`/api/files/${upload.body.id}`).set("Authorization", `Bearer ${getTeamToken()}`);
    expect(download.status).toBe(200);
    expect(download.text).toBe("receipt contents");
    expect(download.headers["content-disposition"]).toContain("receipt.txt");
  });

  it("denies non-admin access to orphan files", async () => {
    const file = await prisma.uploadedFile.create({ data: { originalName: "orphan.txt", mimeType: "text/plain", size: 1, path: "missing-orphan.txt" } });
    createdFileIds.push(file.id);
    const response = await request(app).get(`/api/files/${file.id}`).set("Authorization", `Bearer ${getTeamToken()}`);
    expect(response.status).toBe(403);
  });

  it("returns 404 when the database record exists but the disk file is missing", async () => {
    const file = await prisma.uploadedFile.create({ data: { originalName: "gone.txt", mimeType: "text/plain", size: 1, path: "definitely-missing.txt", declarationId } });
    createdFileIds.push(file.id);
    const response = await request(app).get(`/api/files/${file.id}`).set("Authorization", `Bearer ${getTeamToken()}`);
    expect(response.status).toBe(404);
    expect(response.body.error).toBe("File not found on disk");
  });

  it("sanitizes CRLF characters in downloaded filenames", async () => {
    const fileName = "safe\r\nInjected.txt";
    const diskName = "header-test.txt";
    await fs.writeFile(path.join(uploadDir, diskName), "x");
    const file = await prisma.uploadedFile.create({ data: { originalName: fileName, mimeType: "text/plain", size: 1, path: diskName, declarationId } });
    createdFileIds.push(file.id);
    const response = await request(app).get(`/api/files/${file.id}`).set("Authorization", `Bearer ${getTeamToken()}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-disposition"]).not.toContain("\r");
    expect(response.headers["content-disposition"]).not.toContain("\n");
    await fs.unlink(path.join(uploadDir, diskName)).catch(() => undefined);
  });

  it("exports an XLSX workbook with the declared report columns", async () => {
    const response = await request(app).get("/api/reports/export?reportType=Coverage Test").set("Authorization", `Bearer ${getAdminToken()}`);
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("spreadsheetml.sheet");
    const workbook = XLSX.read(generateExcelBuffer({ fileName: "coverage.xlsx", title: "Coverage Test", columns: [{ header: "ID", key: "id" }, { header: "Counterparty", key: "counterparty" }, { header: "Value", key: "value" }], rows: [{ id: "GHE-1", counterparty: "Vendor", value: 100 }] }), { type: "buffer" });
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
    const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
    expect(rows.some((row) => row.includes("ID"))).toBe(true);
    expect(rows.some((row) => row.includes("Counterparty"))).toBe(true);
    expect(rows.some((row) => row.includes("Value"))).toBe(true);
  });
});
