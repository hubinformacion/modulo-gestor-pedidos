import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getDatabaseUrl } from "@/lib/env";
import * as schema from "./schema";

function createDatabase(pool: Pool) {
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDatabase>;

// A Pool belongs to one request. Always close its WebSockets before returning
// from a serverless invocation; never share live connections across invocations.
export async function withDatabase<T>(work: (db: Database) => Promise<T>): Promise<T> {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    connectionTimeoutMillis: 10_000,
    max: 3,
  });
  try {
    return await work(createDatabase(pool));
  } finally {
    await pool.end();
  }
}
