import { config } from "dotenv";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { authorizedEmails, bankAccounts, campuses, orderAdmissionPolicy } from "./schema";
import { initialBankAccounts, initialCampuses } from "./seed-data";
import { MASTER_EMAIL } from "../lib/access-policy";
import { getDatabaseUrl } from "../lib/env";
import { bankFormSchema } from "../lib/payments/banks-validation";
import { campusSchema } from "../lib/campuses/validation";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

type SeedConnection = Pick<ReturnType<typeof drizzle>, "insert" | "execute">;

export async function seedConfiguration(tx: SeedConnection) {
  // Validate all real configuration before inserting any of it.
  const banks = initialBankAccounts.map((account) => bankFormSchema.parse(account));
  const locations = initialCampuses.map((campus) => campusSchema.parse(campus)).map((campus) => ({
    ...campus, latitude: campus.latitude || null, longitude: campus.longitude || null,
    googleMapsEmbedUrl: campus.googleMapsEmbedUrl || null,
  }));
  await tx.execute(sql`SET LOCAL lock_timeout = '10s'`);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('gestor-pedidos-seed'))`);
  await tx.insert(orderAdmissionPolicy).values({ id: "orders" }).onConflictDoNothing();
  const master = await tx.insert(authorizedEmails).values({ email: MASTER_EMAIL, addedBy: MASTER_EMAIL }).onConflictDoNothing({ target: authorizedEmails.email }).returning({ email: authorizedEmails.email });
  const accounts = await tx.insert(bankAccounts).values(banks).onConflictDoNothing().returning({ id: bankAccounts.id });
  const sites = await tx.insert(campuses).values(locations).onConflictDoNothing().returning({ id: campuses.id });
  return { master: master.length, accounts: accounts.length, campuses: sites.length };
}

async function seed() {
  if (process.argv.length > 2) throw new Error("El seed no acepta argumentos.");
  const pool = new Pool({ connectionString: getDatabaseUrl(), connectionTimeoutMillis: 10_000, query_timeout: 25_000, max: 1 });
  pool.on("error", () => { console.error("No se pudo mantener la conexión del seed."); });
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    client.on("error", () => { console.error("La conexión del seed fue interrumpida."); });
    const added = await drizzle({ client }).transaction(seedConfiguration);
    console.info(`Seed completado. Nuevos registros: maestro ${added.master}, cuentas ${added.accounts}, campus ${added.campuses}. Configuración existente conservada.`);
  } finally {
    try { client?.release(true); } catch { console.error("DB_SEED_RELEASE_UNCONFIRMED"); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([pool.end(), new Promise<void>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("DB_CLOSE_TIMEOUT")), 3_000); })]);
    } catch { console.error("DB_SEED_CLOSE_UNCONFIRMED"); }
    finally { if (timer) clearTimeout(timer); }
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) seed().catch(() => {
  console.error("No se pudo completar el seed. Verifica los datos iniciales, la conexión y el esquema instalado antes de repetir; no se imprimen credenciales ni datos bancarios.");
  process.exitCode = 1;
});
