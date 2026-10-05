import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { MASTER_EMAIL } from "../lib/access-policy";
import { getDatabaseUrl } from "../lib/env";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function seed() {
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  try {
    await drizzle({ client: pool, schema }).insert(schema.authorizedEmails).values({
      email: MASTER_EMAIL,
      addedBy: MASTER_EMAIL,
    }).onConflictDoNothing();
    console.info("Seed completado: correo maestro disponible.");
  } finally {
    await pool.end();
  }
}

seed().catch(() => {
  console.error("No se pudo ejecutar el seed. Verifica DATABASE_URL y las migraciones.");
  process.exitCode = 1;
});
