import { afterEach, expect, it } from "vitest";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { buildApp, getHrToken, getTeamToken } from "./helpers";

const prisma = new PrismaClient();
const app = buildApp();
const declarationId = "GHE-TEST-001";
const createdFileIds: bigint[] = [];
const createdOrganizationIds: bigint[] = [];

async function addFileMetadata(): Promise<bigint> {
  const file = await prisma.uploadedFile.create({
    data: {
      originalName: "scope-check.txt",
      mimeType: "text/plain",
      size: 12,
      // Unauthorized requests must be rejected before this storage reference
      // is inspected or any Azurite call is made.
      storageReference: "azurite:scope-check-placeholder",
    },
  });
  const declaration = await prisma.declaration.findUniqueOrThrow({ where: { id: declarationId } });
  await prisma.declarationFile.create({
    data: { declarationPk: declaration.declarationPk, fileId: file.id },
  });
  createdFileIds.push(file.id);
  return file.id;
}

afterEach(async () => {
  if (createdFileIds.length) {
    await prisma.declarationFile.deleteMany({ where: { fileId: { in: createdFileIds } } });
    await prisma.uploadedFile.deleteMany({ where: { id: { in: createdFileIds } } });
    createdFileIds.length = 0;
  }
  await prisma.declaration.updateMany({ where: { id: declarationId }, data: { organizationId: null } });
  await prisma.user.updateMany({ where: { id: 4n }, data: { organizationId: null } });
  await prisma.user.updateMany({ where: { id: 3n }, data: { position: "Head of HR" } });
  if (createdOrganizationIds.length) {
    await prisma.organization.deleteMany({ where: { id: { in: createdOrganizationIds } } });
    createdOrganizationIds.length = 0;
  }
});

it("rejects a line manager from another department before reading or deleting evidence", async () => {
  await prisma.user.update({ where: { id: 3n }, data: { position: "Line Manager" } });
  const fileId = await addFileMetadata();

  const download = await request(app)
    .get(`/api/files/${fileId}`)
    .set("Authorization", `Bearer ${getHrToken()}`);
  const deletion = await request(app)
    .delete(`/api/files/${fileId}`)
    .set("Authorization", `Bearer ${getHrToken()}`);

  expect(download.status).toBe(403);
  expect(deletion.status).toBe(403);
  expect(await prisma.uploadedFile.findUnique({ where: { id: fileId } })).not.toBeNull();
});

it("rejects an owner after their organization and declaration no longer match", async () => {
  const ownerOrganization = await prisma.organization.create({
    data: { name: "File Scope Owner Org", shortCode: "FSC-OWN" },
  });
  const declarationOrganization = await prisma.organization.create({
    data: { name: "File Scope Declaration Org", shortCode: "FSC-DECL" },
  });
  createdOrganizationIds.push(ownerOrganization.id, declarationOrganization.id);
  await prisma.user.update({ where: { id: 4n }, data: { organizationId: ownerOrganization.id } });
  await prisma.declaration.update({
    where: { id: declarationId },
    data: { organizationId: declarationOrganization.id },
  });
  const fileId = await addFileMetadata();

  const download = await request(app)
    .get(`/api/files/${fileId}`)
    .set("Authorization", `Bearer ${getTeamToken()}`);
  const deletion = await request(app)
    .delete(`/api/files/${fileId}`)
    .set("Authorization", `Bearer ${getTeamToken()}`);

  expect(download.status).toBe(403);
  expect(deletion.status).toBe(403);
  expect(await prisma.uploadedFile.findUnique({ where: { id: fileId } })).not.toBeNull();
});
