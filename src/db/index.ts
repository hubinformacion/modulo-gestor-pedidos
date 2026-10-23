import "server-only";
import { neon, Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { getDatabaseUrl } from "@/shared/config/env";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { DatabaseOperationError, isDatabaseFailure, transientDatabaseFailure } from "./errors";
import * as schema from "./schema";

function createDatabase(client: PoolClient) { return drizzle({ client, schema }); }
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
async function databaseAttempt<T>(work: (db: Database) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000, query_timeout: 25_000, max: 1 });
  let ownedClient: PoolClient | undefined;
  // Pool.error covers idle clients only. Listen before checkout so an active
  // WebSocket failure between queries cannot become an uncaught exception.
  pool.on("connect", (client: PoolClient) => {
    client.on("error", (error: unknown) => {
      if (ownedClient === client) reportServerError("db.client.connection", new DatabaseOperationError(error, "db.websocket.active"));
    });
  });
  pool.on("error", (error: unknown) => reportServerError("db.pool.connection", new DatabaseOperationError(error, "db.websocket")));
  try {
    // Own the checkout instead of delegating it to Drizzle: its Pool transaction
    // implementation starts BEGIN before the finally that releases the client.
    ownedClient = await pool.connect();
    return await work(createDatabase(ownedClient));
  }
  catch (error) {
    if (!isDatabaseFailure(error) && (ownedClient || !transientDatabaseFailure(error))) throw error; // Preserve business/auth errors.
    throw new DatabaseOperationError(error, ownedClient ? "db.transaction" : "db.connect");
  } finally {
    // Destroy only our checkout after work settles. Client.query does not
    // auto-release like Pool.query, so parallel reads cannot release it twice.
    if (ownedClient) {
      try { ownedClient.release(true); }
      catch (error) { reportServerError("db.client.release", new DatabaseOperationError(error, "db.cleanup")); }
    }
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        pool.end(),
        new Promise<void>((_resolve, reject) => {
          closeTimer = setTimeout(() => reject(Object.assign(new Error("DB_POOL_CLOSE_TIMEOUT"), { code: "DB_POOL_CLOSE_TIMEOUT" })), 3_000);
        }),
      ]);
    } catch (error) { reportServerError("db.pool.close", new DatabaseOperationError(error, "db.cleanup")); }
    finally { if (closeTimer) clearTimeout(closeTimer); }
  }
}

export async function withDatabase<T>(work: (db: Database) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await databaseAttempt(work); }
    catch (error) {
      // A failed checkout never called work. Only that phase can be repeated,
      // on a fresh Pool; transactions/auth callbacks are never replayed here.
      if (attempt === 0 && error instanceof DatabaseOperationError && error.stage === "db.connect" && transientDatabaseFailure(error)) continue;
      if (error instanceof DatabaseOperationError) reportServerError("db.operation.failed", error);
      throw error;
    }
  }
  throw new Error("DB_CONNECTION_UNAVAILABLE");
}
