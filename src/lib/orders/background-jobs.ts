import "server-only";
import { recoverCajaMail } from "@/lib/caja/email";
import { and, asc, eq, exists, gte, isNull, lt, ne, or } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { orderEmails, orderNotifications, orders } from "@/db/schema";
import { synchronizeDriveReaders } from "@/lib/payments/drive-access";
import { reportServerError } from "@/lib/server-diagnostics";
import { deliverOrderEmail } from "./email";

export async function processBackgroundJobs() {
  const started = Date.now();
  let permissionsSynced = false;
  try { await synchronizeDriveReaders(); permissionsSynced = true; }
  catch (error) { reportServerError("jobs.drive.access", error); }
  const cajaProcessed = await recoverCajaMail(true);
  const cutoff = new Date(Date.now() - 3600_000);
  // Only retry failed sends, never messages Gmail has already accepted.
  await withDatabase(async (db) => {
    await db.update(orderEmails).set({ status: "PENDIENTE", attempts: 0, lastAttemptAt: null }).where(and(eq(orderEmails.status, "ERROR"), gte(orderEmails.attempts, 5), lt(orderEmails.lastAttemptAt, cutoff)));
    await db.update(orderNotifications).set({ status: "PENDIENTE", attempts: 0, lastAttemptAt: null }).where(and(eq(orderNotifications.status, "ERROR"), gte(orderNotifications.attempts, 5), lt(orderNotifications.lastAttemptAt, cutoff)));
  });
  const pending = await withReadDatabase((db) => db.select({ token: orders.trackingToken }).from(orders).innerJoin(orderEmails, eq(orderEmails.orderId, orders.id)).where(and(
    or(isNull(orderEmails.leaseUntil), lt(orderEmails.leaseUntil, new Date())),
    or(ne(orderEmails.status, "ENVIADO"), exists(db.select({ id: orderNotifications.id }).from(orderNotifications).where(and(eq(orderNotifications.orderId, orders.id), ne(orderNotifications.eventType, "ASIGNADO"), and(ne(orderNotifications.status, "ENVIADO"), ne(orderNotifications.status, "OMITIDO")))))),
  )).orderBy(asc(orderEmails.lastAttemptAt), asc(orders.createdAt)).limit(20));
  let processed = 0;
  for (const row of pending) {
    if (Date.now() - started >= 60_000) break;
    try { await deliverOrderEmail(row.token); processed++; }
    catch (error) { reportServerError("jobs.order.mail", error); }
  }
  return { permissionsSynced, processedOrders: processed, processedCajaRequests: cajaProcessed };
}
