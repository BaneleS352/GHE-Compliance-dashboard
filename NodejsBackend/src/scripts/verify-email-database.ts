import "dotenv/config";
import { PrismaClient } from "@prisma/client";

type RoutineRow = {
  schemaName: string;
  routineName: string;
  routineType: string;
  arguments: string;
};

type TableRow = {
  schemaName: string;
  tableName: string;
  columns: string;
};

type ExtensionRow = { extensionName: string };

const prisma = new PrismaClient();
const requestedRoutine = process.argv.find((arg) => arg.startsWith("--routine="))?.slice("--routine=".length).trim();

if (requestedRoutine && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(requestedRoutine)) {
  console.error("--routine must be a simple procedure/function name (letters, numbers, underscores).");
  process.exit(2);
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error("[FAIL] DATABASE_URL is not set. Add the PostgreSQL connection string to NodejsBackend/.env.");
    process.exitCode = 1;
    return;
  }

  try {
    const [database] = await prisma.$queryRaw<Array<{ version: string; schemaName: string }>>`
      SELECT current_setting('server_version') AS version, current_schema() AS "schemaName"
    `;
    console.log(`[PASS] PostgreSQL connection: server ${database.version}; current schema ${database.schemaName}`);

    const routines = await prisma.$queryRaw<RoutineRow[]>`
      SELECT n.nspname AS "schemaName",
             p.proname AS "routineName",
             CASE p.prokind WHEN 'p' THEN 'PROCEDURE' ELSE 'FUNCTION' END AS "routineType",
             pg_get_function_identity_arguments(p.oid) AS arguments
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND (
          p.proname ILIKE '%email%'
          OR p.proname ILIKE '%mail%'
          OR p.proname ILIKE '%notif%'
        )
      ORDER BY n.nspname, p.proname, p.prokind
    `;
    const matchingRoutines = requestedRoutine
      ? routines.filter((routine) => routine.routineName.toLowerCase() === requestedRoutine.toLowerCase())
      : routines;

    if (matchingRoutines.length === 0) {
      console.log(requestedRoutine
        ? `[MISSING] No email-related routine named ${requestedRoutine} was found.`
        : "[MISSING] No email/mail/notification routine was found in the database.");
    } else {
      console.log(`[PASS] Found ${matchingRoutines.length} matching routine(s):`);
      for (const routine of matchingRoutines) {
        const args = routine.arguments ? `(${routine.arguments})` : "()";
        console.log(`  ${routine.schemaName}.${routine.routineName}${args} — ${routine.routineType}`);
      }
    }

    const tables = await prisma.$queryRaw<TableRow[]>`
      SELECT c.table_schema AS "schemaName",
             c.table_name AS "tableName",
             string_agg(c.column_name || ':' || c.data_type, ', ' ORDER BY c.ordinal_position) AS columns
      FROM information_schema.columns c
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
        AND (
          c.table_name ILIKE '%email%'
          OR c.table_name ILIKE '%mail%'
          OR c.table_name ILIKE '%notif%'
        )
      GROUP BY c.table_schema, c.table_name
      ORDER BY c.table_schema, c.table_name
    `;

    if (tables.length === 0) {
      console.log("[INFO] No email/mail/notification queue tables were found.");
    } else {
      console.log(`[INFO] Found ${tables.length} related table(s):`);
      for (const table of tables) console.log(`  ${table.schemaName}.${table.tableName}: ${table.columns}`);
    }

    const extensions = await prisma.$queryRaw<ExtensionRow[]>`
      SELECT extname AS "extensionName"
      FROM pg_extension
      WHERE extname ILIKE '%mail%' OR extname IN ('pg_net', 'pg_cron', 'dblink')
      ORDER BY extname
    `;
    if (extensions.length === 0) {
      console.log("[INFO] No common mail/network/scheduler extension was found.");
    } else {
      console.log(`[INFO] Related PostgreSQL extension(s): ${extensions.map((row) => row.extensionName).join(", ")}`);
    }

    console.log("[INFO] This is read-only discovery. It does not call a routine, enqueue a message, or send email.");
    if (matchingRoutines.length === 0) process.exitCode = 1;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
    console.error(`[FAIL] Database inspection failed (error code: ${code}). Check DATABASE_URL and database availability.`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
