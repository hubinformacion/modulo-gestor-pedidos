import { config } from "dotenv";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import { authorizedEmails, bankAccounts, campuses } from "./schema";
import { initialBankAccounts, initialCampuses } from "./seed-data";
import { MASTER_EMAIL } from "../lib/access-policy";
import { getDatabaseUrl } from "../lib/env";
import { bankFormSchema } from "../lib/payments/banks-validation";
import { campusSchema } from "../lib/campuses/validation";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function seed() {
  if (process.argv.length > 2) throw new Error("El seed no acepta argumentos.");
  // Validate the supplied real configuration before opening a write transaction.
  const banks = initialBankAccounts.map((account) => bankFormSchema.parse(account));
  const locations = initialCampuses.map((campus) => campusSchema.parse(campus)).map((campus) => ({
    ...campus, latitude: campus.latitude || null, longitude: campus.longitude || null,
    googleMapsEmbedUrl: campus.googleMapsEmbedUrl || null,
  }));
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000, query_timeout: 25_000, max: 1 });
  pool.on("error", () => { console.error("No se pudo mantener la conexión del seed."); });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    client.on("error", () => { console.error("La conexión del seed fue interrumpida."); });
    const added = await drizzle({ client }).transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('gestor-pedidos-seed'))`);
      const master = await tx.insert(authorizedEmails).values({ email: MASTER_EMAIL, addedBy: MASTER_EMAIL }).onConflictDoNothing({ target: authorizedEmails.email }).returning({ email: authorizedEmails.email });
      // Unique indexes normalize campus names and bank/account identities.
      // Existing records keep their IDs, configuration, status and timestamps.
      const accounts = await tx.insert(bankAccounts).values(banks).onConflictDoNothing().returning({ id: bankAccounts.id });
      const sites = await tx.insert(campuses).values(locations).onConflictDoNothing().returning({ id: campuses.id });
      return { master: master.length, accounts: accounts.length, campuses: sites.length };
    });
    console.info(`Seed completado. Nuevos registros: maestro ${added.master}, cuentas ${added.accounts}, campus ${added.campuses}. Configuración existente conservada.`);
  } finally {
    client?.release(true);
    await pool.end();
  }
}
seed().catch(() => {
  console.error("No se pudo completar el seed. Verifica los datos iniciales, la conexión y las migraciones antes de repetir; no se imprimen credenciales ni datos bancarios.");
  process.exitCode = 1;
});
