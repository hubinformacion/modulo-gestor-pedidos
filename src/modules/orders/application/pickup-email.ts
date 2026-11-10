import { withDatabase, withReadDatabase } from "@/db";
import { orders, pickupContacts, pickupNotifications } from "@/db/schema";
import { buildPickupSupportContent } from "./pickup-mail-content";
import { sendPickupSupportEmail } from "@/modules/orders/application/email-sender";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { getTrackedOrder } from "@/modules/orders/data/tracking";
import { getPublicOrigin } from "@/shared/config/application";
import { and, eq } from "drizzle-orm";
import "server-only";

// Accept only the notification created by the current dispatch action. No queue.
export async function deliverPickupSupportEmail(id: string): Promise<boolean> {
  let accepted = false;
  try {
    const [notice] = await withDatabase((db) => db.update(pickupNotifications).set({ status: "ENVIANDO", attempts: 1, lastAttemptAt: new Date() }).where(and(eq(pickupNotifications.id, id), eq(pickupNotifications.status, "NO_ENVIADO"), eq(pickupNotifications.attempts, 0))).returning());
    if (!notice) return false;
    const [record] = await withReadDatabase((db) => db.select({ order: orders, contact: pickupContacts }).from(orders).innerJoin(pickupContacts, eq(pickupContacts.id, notice.contactId)).where(eq(orders.id, notice.orderId)));
    if (!record || record.order.orderStatus !== "DESPACHADO" || record.order.deliveryType !== "recojo_campus" || record.order.pickupContactId !== notice.contactId || record.contact.status !== "ACTIVO" || record.contact.email !== notice.contactEmail || record.order.customerEmail.toLowerCase() === notice.contactEmail) {
      await withDatabase((db) => db.update(pickupNotifications).set({ status: "OMITIDO" }).where(eq(pickupNotifications.id, id)));
      return false;
    }
    const tracking = await getTrackedOrder(record.order.trackingToken);
    if (!tracking) throw new Error("PICKUP_ORDER_UNAVAILABLE");
    const logoCid = `brand-pickup-support-${notice.id}@${new URL(getPublicOrigin()).hostname}`;
    const content = buildPickupSupportContent(tracking.order, tracking.items, notice.contactName, logoCid);
    const sent = await sendPickupSupportEmail(tracking, notice.contactEmail, notice.id, notice.createdAt, content.html, content.text, content.subject);
    accepted = true;
    await withDatabase((db) => db.update(pickupNotifications).set({ status: "ENVIADO", provider: sent.provider, providerMessageId: sent.providerMessageId, gmailMessageId: sent.id, gmailThreadId: sent.threadId }).where(eq(pickupNotifications.id, id)));
    return true;
  } catch (error) {
    if (!accepted) {
      try { await withDatabase((db) => db.update(pickupNotifications).set({ status: "ERROR" }).where(and(eq(pickupNotifications.id, id), eq(pickupNotifications.status, "ENVIANDO")))); }
      catch (persistError) { reportServerError("pickup.support.mail.audit", persistError); }
    }
    reportServerError("pickup.support.mail.immediate", error);
    return accepted;
  }
}
