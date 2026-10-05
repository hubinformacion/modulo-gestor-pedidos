import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { readMigrationFiles } from "drizzle-orm/migrator";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED");
  const sql = neon(process.env.DATABASE_URL);
  const migrations = readMigrationFiles({
    migrationsFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
  });
  await sql.transaction([
    sql`CREATE SCHEMA IF NOT EXISTS drizzle`,
    sql`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  ]);
  const [head] = await sql`SELECT coalesce(max(created_at), 0)::text AS timestamp FROM drizzle.__drizzle_migrations`;
  const timestamp = Number(head.timestamp);
  const pending = migrations.filter((migration) => migration.folderMillis > timestamp);
  if (!pending.length) {
    console.log("No hay migraciones pendientes.");
    return;
  }
  // Serialize runners and abort if another runner advanced the history meanwhile.
  // DDL and its history records are committed together, never statement by statement.
  await sql.transaction([
    sql`SET LOCAL lock_timeout = '10s'`,
    sql`SET LOCAL statement_timeout = '60s'`,
    sql`SELECT pg_advisory_xact_lock(hashtext('gestor-pedidos-migrations'))`,
    sql`SELECT 1 / CASE WHEN coalesce(max(created_at), 0) = ${timestamp} THEN 1 ELSE 0 END FROM drizzle.__drizzle_migrations`,
    ...pending.flatMap((migration) => [
      ...migration.sql.filter((statement) => statement.trim()).map((statement) => sql.query(statement)),
      sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${migration.hash}, ${migration.folderMillis})`,
    ]),
  ], { isolationLevel: "ReadCommitted" });
  console.log(`Migraciones aplicadas: ${pending.length}.`);
}

migrate().catch((error: unknown) => {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "MIGRATION_FAILED";
  console.error(`No se completó la migración (${code}). Revisa el estado antes de repetir; no se imprimen credenciales.`);
  process.exitCode = 1;
});
