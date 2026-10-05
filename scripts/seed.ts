import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "../src/db/schema";
import { seedMaster } from "../src/db/seed-master";
import { getDatabaseUrl } from "../src/lib/env";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function seed() {
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  try {
    await seedMaster(drizzle({ client: pool, schema }));
    console.info("Seed completado: correo maestro disponible.");
  } finally {
    await pool.end();
  }
}

seed().catch(() => {
  console.error("No se pudo ejecutar el seed. Verifica DATABASE_URL y las migraciones.");
  process.exitCode = 1;
});
