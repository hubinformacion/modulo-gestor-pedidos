import "server-only";
import { neon, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/lib/env";
import { reportServerError } from "@/lib/server-diagnostics";
import { DatabaseOperationError, isDatabaseFailure, transientDatabaseFailure } from "./errors";
import * as schema from "./schema";

function createDatabase(pool: Pool) { return drizzle({ client: pool, schema }); }
export type Database = ReturnType<typeof createDatabase>;
function createReadDatabase(signal: AbortSignal) {
  return drizzleHttp({ client: neon(getDatabaseUrl(), { fetchOptions: { signal, cache: "no-store" } }), schema });
}
// SELECT only at the type boundary: never retry an interactive write/transaction.
export type ReadDatabase = Pick<ReturnType<typeof createReadDatabase>, "select" | "selectDistinct" | "selectDistinctOn">;

export async function withReadDatabase<T>(work: (db: ReadDatabase) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try { return await work(createReadDatabase(controller.signal)); }
    catch (error) {
      controller.abort(); // Cancel other reads from this failed parallel batch.
      if (attempt === 0 && transientDatabaseFailure(error)) continue;
      const safe = new DatabaseOperationError(error, "db.http.read");
      reportServerError("db.read.failed", safe);
      throw safe;
    } finally { clearTimeout(timer); }
  }
  throw new Error("DB_READ_UNAVAILABLE");
}

// Interactive transactions/auth keep a Pool scoped to their request. Pure page
// reads use HTTP so parallel queries do not compete for WebSocket connections.
export async function withDatabase<T>(work: (db: Database) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000, max: 3 });
  pool.on("error", (error: unknown) => reportServerError("db.pool.connection", new DatabaseOperationError(error, "db.websocket")));
  try { return await work(createDatabase(pool)); }
  catch (error) {
    if (!isDatabaseFailure(error)) throw error; // Preserve business/auth errors.
    const safe = new DatabaseOperationError(error, "db.transaction");
    reportServerError("db.operation.failed", safe);
    throw safe;
  } finally {
    try { await pool.end(); }
    catch (error) { reportServerError("db.pool.close", new DatabaseOperationError(error, "db.cleanup")); }
  }
}
