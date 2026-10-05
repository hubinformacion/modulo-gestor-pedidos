import "server-only";
import { and, asc, eq, lt, ne, or, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderEmails, orderNotifications, orders } from "@/db/schema";
import { sendOrderUpdateEmail } from "@/lib/google";
import { deliverOrderEmail } from "./email";
import { getTrackedOrder } from "./tracking";

// Each event is committed together with the state change. A Gmail outage never
// rolls back a confirmed receipt, and retrying delivery does not change its state.
export async function deliverOrderNotification(id: string) {
  const event = await withDatabase(async (db) => {
    const [row] = await db.select({ notification: orderNotifications, token: orders.trackingToken }).from(orderNotifications).innerJoin(orders, eq(orders.id, orderNotifications.orderId)).where(eq(orderNotifications.id, id));
    return row;
  });
  if (!event) return false;
  if (event.notification.status === "ENVIADO") return true;
  let tracking = await getTrackedOrder(event.token);
  if (!tracking) return false;
  if (tracking.emailStatus !== "ENVIADO") {
    await deliverOrderEmail(event.token);
    tracking = await getTrackedOrder(event.token);
    if (!tracking || tracking.emailStatus !== "ENVIADO") return false;
  }
  const claimed = await withDatabase((db) => db.update(orderNotifications).set({ status: "ENVIANDO", attempts: sql`${orderNotifications.attempts} + 1`, lastAttemptAt: new Date() }).where(and(
    eq(orderNotifications.id, id), lt(orderNotifications.attempts, 5),
    or(eq(orderNotifications.status, "PENDIENTE"), and(eq(orderNotifications.status, "ERROR"), lt(orderNotifications.lastAttemptAt, new Date(Date.now() - 60_000))), and(eq(orderNotifications.status, "ENVIANDO"), lt(orderNotifications.lastAttemptAt, new Date(Date.now() - 180_000)))),
  )).returning({ attempts: orderNotifications.attempts }));
  if (!claimed.length) return false;
  try {
    const sent = await sendOrderUpdateEmail(tracking, event.notification);
    await withDatabase((db) => db.transaction(async (tx) => {
      await tx.update(orderNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id }).where(and(eq(orderNotifications.id, id), eq(orderNotifications.attempts, claimed[0].attempts)));
      // Legacy confirmations lacked a persisted thread ID. Replies include the
      // original Message-ID; save Gmail's resulting conversation for later events.
      if (!tracking.emailThreadId || !tracking.emailRfcMessageId) await tx.update(orderEmails).set({ gmailThreadId: sent.threadId, rfcMessageId: sent.rootMessageId }).where(eq(orderEmails.orderId, tracking.order.id));
    }));
    return true;
  } catch {
    await withDatabase((db) => db.update(orderNotifications).set({ status: "ERROR" }).where(and(eq(orderNotifications.id, id), eq(orderNotifications.attempts, claimed[0].attempts))));
    return false;
  }
}

export async function retryOrderNotifications(token: string) {
  const pending = await withDatabase(async (db) => db.select({ id: orderNotifications.id }).from(orderNotifications).innerJoin(orders, eq(orders.id, orderNotifications.orderId)).where(and(eq(orders.trackingToken, token), ne(orderNotifications.status, "ENVIADO"))).orderBy(asc(orderNotifications.createdAt)).limit(10));
  let sent = false;
  for (const event of pending) sent = await deliverOrderNotification(event.id) || sent;
  return sent;
}
