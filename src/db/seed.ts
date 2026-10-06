import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { authorizedEmails } from "./schema";
import { MASTER_EMAIL } from "../lib/access-policy";
import { getDatabaseUrl } from "../lib/env";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function seed() {
  if (process.argv.length > 2) throw new Error("El seed no acepta argumentos.");
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  try {
    await drizzle({ client: pool }).insert(authorizedEmails).values({ email: MASTER_EMAIL, addedBy: MASTER_EMAIL }).onConflictDoNothing({ target: authorizedEmails.email });
    console.info("Seed completado: correo maestro disponible.");
  } finally { await pool.end(); }
}
seed().catch(() => {
  console.error("No se pudo ejecutar el seed. Verifica la configuración y las migraciones.");
  process.exitCode = 1;
});
