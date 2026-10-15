import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";
import { Pool, type PoolClient } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { getDatabaseUrl } from "../lib/env";
import { seedConfiguration } from "./seed";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

// Compare PostgreSQL's own canonical definitions on the same server/version.
// Do not compare row data, physical column order, sequence counters or OIDs.
const catalogQuery = `
SELECT jsonb_build_object(
  'tables', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', t.relname, 'kind', t.relkind, 'rls', t.relrowsecurity,
      'force_rls', t.relforcerowsecurity,
      'columns', (SELECT jsonb_agg(jsonb_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'required', a.attnotnull, 'identity', a.attidentity, 'generated', a.attgenerated,
        'default', pg_get_expr(d.adbin, d.adrelid),
        'collation', (SELECT n.nspname || '.' || c.collname FROM pg_collation c JOIN pg_namespace n ON n.oid = c.collnamespace WHERE c.oid = a.attcollation)
      ) ORDER BY a.attname) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = t.oid AND a.attnum > 0 AND NOT a.attisdropped),
      'constraints', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name', c.conname, 'type', c.contype, 'definition', pg_get_constraintdef(c.oid, true),
        'validated', c.convalidated, 'deferrable', c.condeferrable, 'deferred', c.condeferred
      ) ORDER BY c.conname) FROM pg_constraint c WHERE c.conrelid = t.oid), '[]'::jsonb),
      'triggers', COALESCE((SELECT jsonb_agg(pg_get_triggerdef(g.oid, true) ORDER BY g.tgname) FROM pg_trigger g WHERE g.tgrelid = t.oid AND NOT g.tgisinternal), '[]'::jsonb),
      'policies', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', p.polname, 'command', p.polcmd, 'permissive', p.polpermissive, 'using', pg_get_expr(p.polqual, p.polrelid), 'check', pg_get_expr(p.polwithcheck, p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid = t.oid), '[]'::jsonb),
      'indexes', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'name', x.relname, 'definition', pg_get_indexdef(i.indexrelid),
        'valid', i.indisvalid, 'ready', i.indisready
      ) ORDER BY x.relname) FROM pg_index i JOIN pg_class x ON x.oid = i.indexrelid WHERE i.indrelid = t.oid), '[]'::jsonb)
    ) ORDER BY t.relname) FROM pg_class t JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = $1 AND t.relkind IN ('r', 'p', 'v', 'm', 'f')
  ), '[]'::jsonb),
  'functions', COALESCE((SELECT jsonb_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname, p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e')), '[]'::jsonb),
  'custom_types', COALESCE((SELECT jsonb_agg(t.typname ORDER BY t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace LEFT JOIN pg_class c ON c.oid = t.typrelid WHERE n.nspname = $1 AND (t.typtype = 'd' OR (t.typtype = 'c' AND c.relkind = 'c'))), '[]'::jsonb),
  'enums', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'name', t.typname, 'values', (SELECT jsonb_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)
  ) ORDER BY t.typname) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1 AND t.typtype = 'e'), '[]'::jsonb),
  'sequences', COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'name', c.relname, 'type', format_type(s.seqtypid, NULL), 'start', s.seqstart,
    'increment', s.seqincrement, 'min', s.seqmin, 'max', s.seqmax, 'cache', s.seqcache, 'cycle', s.seqcycle
  ) ORDER BY c.relname) FROM pg_sequence s JOIN pg_class c ON c.oid = s.seqrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1), '[]'::jsonb)
) AS definition`;

type Catalog = { tables: unknown[]; enums: unknown[]; sequences: unknown[]; functions: unknown[]; custom_types: unknown[] };
async function describe(client: PoolClient, namespace: string) {
  // An identical search_path makes pg_get_* qualify both schemas consistently.
  await client.query("SET LOCAL search_path TO pg_catalog");
  const result = await client.query<{ definition: Catalog }>(catalogQuery, [namespace]);
  const definition = result.rows[0].definition;
  const serialized = JSON.stringify(definition).replaceAll(`\\\"${namespace}\\\".`, "@schema.").replaceAll(`${namespace}.`, "@schema.");
  return { definition, serialized };
}
async function apply(client: PoolClient, namespace: string, source: string) {
  // namespace is internal (public or a UUID suffix), never a CLI/customer value.
  if (!/^[a-z][a-z0-9_]*$/.test(namespace)) throw new Error("INVALID_INSTALL_NAMESPACE");
  await client.query(`SET LOCAL search_path TO "${namespace}", pg_catalog`);
  await client.query(source.replaceAll('"public".', `"${namespace}".`));
}

async function setup() {
  if (process.argv.length > 2) throw new Error("El instalador no acepta argumentos.");
  const source = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  const privilegedUrl = process.env.DATABASE_SETUP_URL?.trim();
  if (privilegedUrl && !/^postgres(ql)?:$/.test(new URL(privilegedUrl).protocol)) throw new Error("INVALID_SETUP_URL");
  const pool = new Pool({ connectionString: privilegedUrl || getDatabaseUrl(), connectionTimeoutMillis: 10_000, query_timeout: 90_000, max: 1 });
  pool.on("error", () => { console.error("DB_INSTALL_CONNECTION_ERROR"); });
  let client: PoolClient | undefined;
  let began = false;
  let committing = false;
  try {
    client = await pool.connect();
    client.on("error", () => { console.error("DB_INSTALL_CONNECTION_ERROR"); });
    await client.query("BEGIN"); began = true;
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('gestor-pedidos-setup'))");
    const actual = await describe(client, "public");
    const empty = Object.values(actual.definition).every((objects) => objects.length === 0);
    // Build the reference in a disposable schema and roll it back completely.
    // No development snapshots/history or persistent installation marker needed.
    const reference = `fec_install_${randomUUID().replaceAll("-", "")}`;
    await client.query("SAVEPOINT reference_schema");
    await client.query(`CREATE SCHEMA "${reference}"`);
    await apply(client, reference, source);
    const expected = await describe(client, reference);
    await client.query("ROLLBACK TO SAVEPOINT reference_schema");
    await client.query("RELEASE SAVEPOINT reference_schema");
    if (!empty && actual.serialized !== expected.serialized) throw new Error("DB_SCHEMA_INCOMPATIBLE");
    if (empty) {
      await apply(client, "public", source);
      if ((await describe(client, "public")).serialized !== expected.serialized) throw new Error("DB_SCHEMA_INCOMPATIBLE");
    }
    await client.query("SET LOCAL search_path TO public, pg_catalog");
    const added = await seedConfiguration(drizzle({ client }));
    committing = true;
    await client.query("COMMIT"); began = false;
    console.info(`Instalación ${empty ? "creada" : "compatible, conservada"}. Nuevos registros: maestro ${added.master}, cuentas ${added.accounts}, campus ${added.campuses}.`);
  } catch (error) {
    if (client && began && !committing) { try { await client.query("ROLLBACK"); } catch { /* Connection is destroyed below. */ } }
    if (committing) console.error("No se pudo confirmar el resultado del commit. Revisa la BD antes de repetir.");
    throw error;
  } finally {
    try { client?.release(true); } catch { console.error("DB_INSTALL_RELEASE_UNCONFIRMED"); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([pool.end(), new Promise<void>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("DB_CLOSE_TIMEOUT")), 3_000); })]);
    } catch { console.error("DB_INSTALL_CLOSE_UNCONFIRMED"); }
    finally { if (timer) clearTimeout(timer); }
  }
}
setup().catch((error: unknown) => {
  console.error(error instanceof Error && error.message === "DB_SCHEMA_INCOMPATIBLE"
    ? "El esquema existente no coincide con esta versión. No se instaló ni sembró información. Revisa una actualización explícita; no borres la BD."
    : "No se completó la instalación. Revisa conexión, permisos y esquema. No se imprimen SQL, datos ni credenciales.");
  process.exitCode = 1;
});
