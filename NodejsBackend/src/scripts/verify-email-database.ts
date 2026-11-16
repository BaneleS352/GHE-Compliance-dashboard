import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type RoutineRow = {
  schemaName: string;
  routineName: string;
  routineType: string;
  argumentCount: number;
  arguments: string;
};

type ColumnRow = {
  columnName: string;
  dataType: string;
};

const EXPECTED_ROUTINE = "enqueue_email_notification";
const EXPECTED_TABLE = "EmailOutbox";
const EXPECTED_ARGUMENTS = [
  "IN p_event text",
  "IN p_declaration_id text",
  "IN p_recipient_email text",
  "IN p_subject text",
  "IN p_body text",
  "IN p_dedupe_key text",
];
const REQUIRED_COLUMNS = [
  "id",
  "event",
  "declarationId",
  "recipientEmail",
  "subject",
  "body",
  "dedupeKey",
  "status",
  "attemptCount",
  "maxAttempts",
  "nextAttemptAt",
  "lockedAt",
  "lockedBy",
  "sentAt",
  "providerMessageId",
  "lastErrorCode",
  "createdAt",
  "updatedAt",
] as const;

const prisma = new PrismaClient();
const requestedRoutine = process.argv.find((arg) => arg.startsWith("--routine="))?.slice("--routine=".length).trim();
const routineName = requestedRoutine || EXPECTED_ROUTINE;

if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(routineName)) {
  console.error("--routine must be a simple procedure name (letters, numbers, underscores).");
  process.exit(2);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[FAIL] DATABASE_URL is not set. Add the PostgreSQL connection string to NodejsBackend/.env.");
    process.exitCode = 1;
    return;
  }

  let failures = 0;
  try {
    const [database] = await prisma.$queryRaw<Array<{ version: string; schemaName: string }>>`
      SELECT current_setting('server_version') AS version, current_schema() AS "schemaName"
    `;
    console.log(`[PASS] PostgreSQL connection: server ${database.version}; current schema ${database.schemaName}`);

    const routines = await prisma.$queryRaw<RoutineRow[]>`
      SELECT n.nspname AS "schemaName",
             p.proname AS "routineName",
             CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS "routineType",
             p.pronargs AS "argumentCount",
             pg_get_function_identity_arguments(p.oid) AS arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = ${routineName}
      ORDER BY p.prokind
    `;
    const procedure = routines.find((routine) => routine.routineType === "PROCEDURE");
    if (!procedure) {
      console.error(`[FAIL] Required public procedure ${routineName} was not found.`);
      failures++;
    } else if (
      procedure.argumentCount !== EXPECTED_ARGUMENTS.length ||
      procedure.arguments.split(",").map((argument) => argument.trim().toLowerCase()).join("|") !== EXPECTED_ARGUMENTS.map((argument) => argument.toLowerCase()).join("|")
    ) {
      console.error(`[FAIL] public.${routineName} has an unexpected signature: ${procedure.arguments || "()"}`);
      console.error("       Expected six TEXT parameters in this order: event, declaration ID, recipient email, subject, body, dedupe key.");
      failures++;
    } else {
      console.log(`[PASS] Stored procedure: public.${routineName}(${procedure.arguments})`);
    }

    const columns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT column_name AS "columnName", data_type AS "dataType"
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${EXPECTED_TABLE}
      ORDER BY ordinal_position
    `;
    if (columns.length === 0) {
      console.error(`[FAIL] Required table public.${EXPECTED_TABLE} was not found.`);
      failures++;
    } else {
      const actual = new Set(columns.map((column) => column.columnName));
      const missing = REQUIRED_COLUMNS.filter((column) => !actual.has(column));
      if (missing.length > 0) {
        console.error(`[FAIL] public.${EXPECTED_TABLE} is missing required columns: ${missing.join(", ")}`);
        failures++;
      } else {
        console.log(`[PASS] Outbox table: public.${EXPECTED_TABLE} has all ${REQUIRED_COLUMNS.length} required columns`);
        console.log(`[INFO] Outbox columns/types: ${columns.map((column) => `${column.columnName}:${column.dataType}`).join(", ")}`);
      }
    }

    if (failures > 0) {
      console.error(`[FAIL] ${failures} email database contract check(s) failed. From NodejsBackend, check migration status with "npx prisma migrate status" and apply a pending migration with "npx prisma migrate deploy" before rerunning this command.`);
      process.exitCode = 1;
    } else {
      console.log("[PASS] Email outbox database contract is installed.");
    }
    console.log("[INFO] Read-only verification: the procedure was not called, no row was enqueued, and no email was sent.");
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error(`[FAIL] Database inspection failed (error code: ${code}). Check DATABASE_URL and database availability.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
