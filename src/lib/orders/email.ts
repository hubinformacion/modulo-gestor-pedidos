import "server-only";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderEmails } from "@/db/schema";
import { getTrackedOrder } from "./tracking";
import { sendOrderConfirmationEmail } from "@/lib/google";

export async function deliverOrderEmail(token: string) {
  const tracking = await getTrackedOrder(token);
  if (!tracking) return false;
  const claimed = await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIANDO", attempts: sql`${orderEmails.attempts} + 1`, lastAttemptAt: new Date() })
    .where(and(eq(orderEmails.orderId, tracking.order.id), lt(orderEmails.attempts, 5),
      or(eq(orderEmails.status, "PENDIENTE"), and(eq(orderEmails.status, "ERROR"), lt(orderEmails.lastAttemptAt, new Date(Date.now() - 60_000))), and(eq(orderEmails.status, "ENVIANDO"), lt(orderEmails.lastAttemptAt, new Date(Date.now() - 180_000))))))
    .returning({ attempts: orderEmails.attempts }));
  if (!claimed.length) return false;
  try {
    const gmailMessageId = await sendOrderConfirmationEmail(tracking);
    await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIADO", gmailMessageId, sentAt: new Date() }).where(and(eq(orderEmails.orderId, tracking.order.id), eq(orderEmails.attempts, claimed[0].attempts))));
    return true;
  } catch {
    await withDatabase((db) => db.update(orderEmails).set({ status: "ERROR" }).where(and(eq(orderEmails.orderId, tracking.order.id), eq(orderEmails.attempts, claimed[0].attempts))));
    return false;
  }
}
