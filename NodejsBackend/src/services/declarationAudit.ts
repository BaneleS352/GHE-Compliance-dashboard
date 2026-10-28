import { Prisma, PrismaClient } from "@prisma/client";
import { toDbId } from "./ids";

export type DeclarationAuditAction =
  | "created"
  | "updated"
  | "submitted"
  | "workflow_decision"
  | "status_overridden"
  | "deleted"
  | "file_uploaded"
  | "file_deleted";

type AuditClient = PrismaClient | Prisma.TransactionClient;

export interface DeclarationAuditInput {
  declarationPk: bigint;
  declarationId: string;
  organizationId: bigint | null;
  actorUserId: number | bigint | null;
  actorName: string | null;
  action: DeclarationAuditAction;
  changedFields: string[];
  oldValues?: unknown;
  newValues?: unknown;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item instanceof Date ? item.toISOString() : item,
  )) as Prisma.InputJsonValue;
}

/** Store an immutable, tenant-labelled event atomically with its business write. */
export async function recordDeclarationAudit(
  client: AuditClient,
  event: DeclarationAuditInput,
): Promise<void> {
  await client.declarationAuditEvent.create({
    data: {
      declarationPk: event.declarationPk,
      declarationId: event.declarationId,
      organizationId: event.organizationId,
      actorUserId: event.actorUserId === null ? null : toDbId(event.actorUserId),
      actorName: event.actorName,
      action: event.action,
      changedFields: event.changedFields,
      ...(event.oldValues === undefined ? {} : { oldValues: toJson(event.oldValues) }),
      ...(event.newValues === undefined ? {} : { newValues: toJson(event.newValues) }),
    },
  });
}
