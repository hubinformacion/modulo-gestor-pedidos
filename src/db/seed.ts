import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import { MASTER_EMAIL } from "../lib/access-policy";
import { getDatabaseUrl } from "../lib/env";
import { demoBooks } from "./seeds/demo-books";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function seed() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--demo")) {
    throw new Error("Argumento no reconocido. Usa db:seed o db:seed:demo.");
  }
  const includeDemo = args.includes("--demo");
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000 });
  try {
    const inserted = await drizzle({ client: pool, schema }).transaction(async (tx) => {
      await tx.insert(schema.authorizedEmails).values({
        email: MASTER_EMAIL,
        addedBy: MASTER_EMAIL,
      }).onConflictDoNothing({ target: schema.authorizedEmails.email });
      if (!includeDemo) return [];
      return tx.insert(schema.books).values(demoBooks)
        .onConflictDoNothing({ target: schema.books.inventoryCode })
        .returning({ inventoryCode: schema.books.inventoryCode });
    });
    console.info("Seed completado: correo maestro disponible.");
    if (includeDemo) {
      console.info(`Catálogo DEMO: ${inserted.length} libros añadidos. No se sobrescribieron precios, stock ni estados existentes.`);
    }
  } finally {
    await pool.end();
  }
}

seed().catch(() => {
  console.error("No se pudo ejecutar el seed. Verifica DATABASE_URL y las migraciones.");
  process.exitCode = 1;
});
