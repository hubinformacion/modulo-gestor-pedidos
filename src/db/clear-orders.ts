import { Pool, type PoolClient } from "@neondatabase/serverless";
import { config } from "dotenv";
import { OAuth2Client } from "google-auth-library";
import { drive } from "googleapis/build/src/apis/drive/index.js";

// Standalone maintenance command: never imported by routes or deployment builds.
const orderTables = [
  "orders", "order_items", "payment_receipts", "payment_uploads",
  "pickup_evidence", "order_activity", "order_emails", "order_notifications",
  "caja_requests", "caja_notifications", "sale_documents",
  "treasury_notes", "treasury_activity", "treasury_observations", "treasury_supporting_files",
  "sale_document_batches", "drive_file_reader_grants", "coupon_redemptions",
  "order_counters", "payment_guides",
] as const;
const fullReset = process.argv.includes("--reset-all-except-bank-accounts");
const tables: readonly string[] = fullReset ? [...orderTables,
  "books", "campuses", "promotions", "promotion_books", "coupons",
  "treasury_mailboxes", "drive_reader_grants", "authorized_emails",
  "account", "session", "user", "verification",
] : orderTables;
const masterEmail = "distribucionfe@continental.edu.pe";
const tableSql = tables.map((table) => `public."${table}"`).join(", ");
type Grant = { drive_file_id: string; email: string; managed: boolean };
type Snapshot = { table_name: string; count: string; fingerprint: string };

function fail(code: string): never { throw new Error(code); }

async function snapshot(client: PoolClient) {
  // Only counts and opaque fingerprints leave PostgreSQL; never log order data.
  const { rows } = await client.query<Snapshot>(tables.map((table) => `
    SELECT '${table}' AS table_name, count(*)::text AS count,
      md5(coalesce(string_agg(row_hash, '' ORDER BY row_hash), '')) AS fingerprint
    FROM (SELECT md5(to_jsonb(t)::text) AS row_hash FROM public."${table}" t) s
  `).join(" UNION ALL ") + " ORDER BY table_name");
  return rows;
}

async function checkScope(client: PoolClient) {
  if (fullReset) {
    const unknown = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT (tablename = ANY($1::text[]))", [[...tables, "bank_accounts"]]);
    if (unknown.rowCount) fail("FULL_RESET_SCHEMA_CHANGED");
  }
  const { rows } = await client.query<{ unexpected: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint c
      JOIN pg_class parent ON parent.oid = c.confrelid
      JOIN pg_namespace pn ON pn.oid = parent.relnamespace
      JOIN pg_class child ON child.oid = c.conrelid
      JOIN pg_namespace cn ON cn.oid = child.relnamespace
      WHERE c.contype = 'f' AND pn.nspname = 'public'
        AND parent.relname = ANY($1::text[])
        AND NOT (cn.nspname = 'public' AND child.relname = ANY($1::text[]))
    ) AS unexpected
  `, [tables]);
  if (rows[0].unexpected) fail("ORDER_SCHEMA_CHANGED");
  const leases = await client.query<{ active: boolean }>(`
    SELECT EXISTS (SELECT 1 FROM public.order_emails WHERE lease_until > now())
      OR EXISTS (SELECT 1 FROM public.caja_requests WHERE lease_until > now()) AS active
  `);
  if (leases.rows[0].active) fail("MAIL_WORKER_ACTIVE");
  if (fullReset) return;
  const counters = await client.query<{ invalid: boolean }>(`
    SELECT EXISTS (
      SELECT 1 FROM public.coupons c JOIN (
        SELECT coupon_id, count(*) AS uses FROM public.coupon_redemptions
        WHERE released_at IS NULL GROUP BY coupon_id
      ) r ON r.coupon_id = c.id WHERE c.used_count < r.uses
    ) AS invalid
  `);
  if (counters.rows[0].invalid) fail("COUPON_COUNTER_INCONSISTENT");
}

function status(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  if ("response" in error && error.response && typeof error.response === "object" && "status" in error.response) {
    return Number(error.response.status);
  }
  return "code" in error ? Number(error.code) : undefined;
}

async function revokeCajaReaders(grants: Grant[]) {
  if (!grants.some((grant) => grant.managed)) return;
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REFRESH_TOKEN) {
    fail("GOOGLE_CREDENTIALS_REQUIRED");
  }
  const auth = new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  const api = drive({ version: "v3", auth });
  for (const grant of grants) {
    if (!grant.managed) continue;
    const revoke = async () => {
      // Re-read current role/source, including ambiguous creates without an ID.
      // Delete only direct readers matching the tracked email, never folder ACLs.
      let pageToken: string | undefined;
      do {
        const response = await api.permissions.list({
          fileId: grant.drive_file_id, supportsAllDrives: true, pageToken,
          fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails)",
        }, { timeout: 15_000, retry: false });
        for (const permission of response.data.permissions ?? []) {
          if (permission.type !== "user" || permission.emailAddress?.toLowerCase() !== grant.email.toLowerCase()
            || permission.role !== "reader" || !permission.id
            || permission.permissionDetails?.some((detail) => detail.inherited)) continue;
          try {
            await api.permissions.delete({ fileId: grant.drive_file_id, permissionId: permission.id, supportsAllDrives: true }, { timeout: 15_000, retry: false });
          } catch (error) { if (status(error) !== 404) throw error; }
        }
        pageToken = response.data.nextPageToken ?? undefined;
      } while (pageToken);
    };
    // Removal is idempotent. A failed list (including 404) must not silently
    // discard the durable grant: inaccessible and deleted files can look alike.
    try { await revoke(); }
    catch {
      try { await revoke(); }
      catch { fail("DRIVE_ACL_CLEANUP_FAILED"); }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Vista previa: pnpm db:orders:clear\nBorrar pedidos: pnpm db:orders:clear --execute --maintenance --confirm=ELIMINAR_TODOS_LOS_PEDIDOS\nReinicio completo: pnpm db:orders:clear --reset-all-except-bank-accounts --execute --maintenance --confirm=REINICIAR_BD_CONSERVAR_CUENTAS\nEl reinicio completo conserva bank_accounts, el esquema y migraciones, y habilita únicamente el correo maestro. --maintenance exige tráfico/cron/cargas detenidos externamente.");
    return;
  }
  const allowed = new Set(["--execute", "--maintenance", "--confirm=ELIMINAR_TODOS_LOS_PEDIDOS", "--keep-stock", "--reset-all-except-bank-accounts", "--confirm=REINICIAR_BD_CONSERVAR_CUENTAS"]);
  if (args.some((arg) => !allowed.has(arg))) fail("INVALID_ARGUMENTS");
  const execute = args.includes("--execute");
  if (fullReset && args.includes("--keep-stock")) fail("INVALID_ARGUMENTS");
  const confirmation = fullReset ? "--confirm=REINICIAR_BD_CONSERVAR_CUENTAS" : "--confirm=ELIMINAR_TODOS_LOS_PEDIDOS";
  if (execute && (!args.includes("--maintenance") || !args.includes(confirmation))) {
    fail("EXPLICIT_CONFIRMATION_AND_MAINTENANCE_REQUIRED");
  }
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
  if (!process.env.DATABASE_URL) fail("DATABASE_URL_REQUIRED");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000, max: 1 });
  pool.on("error", () => { console.error("DB_CONNECTION_ERROR"); process.exitCode = 1; });
  let client: PoolClient | undefined;
  let commitStarted = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await checkScope(client);
    const before = await snapshot(client);
    const { rows: grants } = await client.query<Grant>(fullReset
      ? "SELECT drive_file_id, email, managed FROM public.drive_file_reader_grants UNION ALL SELECT folder_id AS drive_file_id, email, true AS managed FROM public.drive_reader_grants ORDER BY drive_file_id, email"
      : "SELECT drive_file_id, email, managed FROM public.drive_file_reader_grants ORDER BY drive_file_id, email");
    const bankFingerprint = async () => (await client!.query<{ fingerprint: string; count: string }>("SELECT count(*)::text AS count, md5(coalesce(string_agg(md5(to_jsonb(b)::text), '' ORDER BY id), '')) AS fingerprint FROM public.bank_accounts b")).rows[0];
    const banksBefore = fullReset ? await bankFingerprint() : null;
    const { rows: units } = await client.query<{ units: string }>(`
      SELECT coalesce(sum(i.quantity), 0)::text AS units FROM public.order_items i
      JOIN public.orders o ON o.id = i.order_id WHERE o.stock_restored_at IS NULL
    `);
    await client.query("COMMIT");
    console.log(fullReset ? "Alcance: TODA la información de DATABASE_URL excepto las cuentas bancarias. Se restablece únicamente la autorización maestra." : "Alcance: TODOS los pedidos de DATABASE_URL, sin distinguir demos de pedidos reales.");
    if (banksBefore) console.log(`Cuentas bancarias a conservar sin cambios: ${banksBefore.count}.`);
    for (const row of before) console.log(`${row.table_name}: ${row.count}`);
    console.log(`Unidades a restituir: ${fullReset ? "0 (catálogo eliminado)" : args.includes("--keep-stock") ? "0 (stock actual conservado)" : units[0].units}. Permisos individuales registrados: ${grants.length}.`);
    if (!execute) {
      console.log("Vista previa de solo lectura. No se cambió la BD ni Google. Usa --help para ver el comando de borrado.");
      return;
    }

    // --maintenance acknowledges that traffic, cron and in-flight uploads/jobs
    // have been stopped externally. DB locks cannot stop Google operations.
    await revokeCajaReaders(grants);
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '10s'");
    await client.query("SET LOCAL statement_timeout = '60s'");
    await client.query(`LOCK TABLE ${fullReset ? `${tableSql}, public.bank_accounts` : `${tableSql}, public.books, public.coupons`} IN ACCESS EXCLUSIVE MODE`);
    await checkScope(client);
    const current = await snapshot(client);
    if (JSON.stringify(current) !== JSON.stringify(before)) fail("ORDERS_CHANGED_DURING_MAINTENANCE");
    if (!fullReset && !args.includes("--keep-stock")) {
      await client.query(`
        UPDATE public.books b SET stock = b.stock + restored.quantity, updated_at = now()
        FROM (SELECT i.book_id, sum(i.quantity) AS quantity FROM public.order_items i
          JOIN public.orders o ON o.id = i.order_id WHERE o.stock_restored_at IS NULL
          GROUP BY i.book_id) restored WHERE b.id = restored.book_id
      `);
    }
    if (!fullReset) await client.query(`
      UPDATE public.coupons c SET used_count = c.used_count - restored.uses, updated_at = now()
      FROM (SELECT coupon_id, count(*) AS uses FROM public.coupon_redemptions
        WHERE released_at IS NULL GROUP BY coupon_id) restored WHERE c.id = restored.coupon_id
    `);
    // Explicit scope and RESTRICT: a future FK must abort, never expand deletion.
    // One TRUNCATE also resolves the circular receipt/document references.
    if (fullReset && JSON.stringify(await bankFingerprint()) !== JSON.stringify(banksBefore)) fail("BANK_ACCOUNTS_CHANGED_DURING_MAINTENANCE");
    await client.query(`TRUNCATE TABLE ${tableSql}${fullReset ? " RESTART IDENTITY" : ""} RESTRICT`);
    if (fullReset) {
      await client.query("INSERT INTO public.authorized_emails (email, added_by) VALUES ($1, $1)", [masterEmail]);
      if (JSON.stringify(await bankFingerprint()) !== JSON.stringify(banksBefore)) fail("BANK_ACCOUNTS_CHANGED_DURING_MAINTENANCE");
    }
    commitStarted = true;
    await client.query("COMMIT");
    console.log(fullReset ? "Reinicio completado. Solo se conservan las cuentas bancarias sin cambios y la autorización del correo maestro. Usuarios OAuth, sesiones, catálogo, campus, buzones, pedidos e historial eliminados; numeración reiniciada. Esquema/migraciones y archivos/correos físicos de Google conservados." : "Pedidos y dependencias eliminados. Numeración reiniciada. Configuración y accesos conservados. Archivos y correos de Google conservados.");
  } catch (error) {
    if (client) { try { await client.query("ROLLBACK"); } catch { /* Only safe codes are reported below. */ } }
    if (execute) {
      console.error(commitStarted
        ? "COMMIT no confirmado: consulta la vista previa antes de repetir. Los permisos de caja pudieron retirarse."
        : "Limpieza de BD no completada; la transacción se revierte. Los permisos individuales de caja ya retirados en Google no se revierten. Mantén el mantenimiento y resuelve el error antes de repetir.");
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const known = new Set(["FULL_RESET_SCHEMA_CHANGED", "BANK_ACCOUNTS_CHANGED_DURING_MAINTENANCE", "INVALID_ARGUMENTS", "EXPLICIT_CONFIRMATION_AND_MAINTENANCE_REQUIRED", "DATABASE_URL_REQUIRED", "ORDER_SCHEMA_CHANGED", "MAIL_WORKER_ACTIVE", "COUPON_COUNTER_INCONSISTENT", "GOOGLE_CREDENTIALS_REQUIRED", "DRIVE_ACL_CLEANUP_FAILED", "ORDERS_CHANGED_DURING_MAINTENANCE"]);
  const code = error instanceof Error && known.has(error.message) ? error.message : "ORDER_CLEANUP_FAILED";
  console.error(`No se completó la operación (${code}). No se imprimen datos personales ni credenciales.`);
  process.exitCode = 1;
});
