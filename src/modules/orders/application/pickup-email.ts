import { withDatabase, withReadDatabase } from "@/db";
import { orders, pickupContacts, pickupNotifications } from "@/db/schema";
import { emailAction, emailHeading, emailShell, escapeHtml } from "@/integrations/email/template";
import { sendPickupSupportEmail } from "@/modules/orders/application/email-sender";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { getTrackedOrder } from "@/modules/orders/data/tracking";
import { formatOrderNumber } from "@/modules/orders/domain/number";
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
    const { order, items } = tracking;
    const details = [["Persona que recoge", order.deliveryRecipient], ["DNI / documento", order.deliveryRecipientDocument ?? order.customerDocument], ["Celular", order.deliveryRecipientPhone ?? order.customerPhone], ["Biblioteca", order.deliveryAddress], ["Ubicación", order.deliveryLibraryLocation ?? ""], ["Horario", order.deliveryPickupHours ?? ""]].filter(([, value]) => Boolean(value));
    const logoCid = `brand-pickup-support-${notice.id}@${new URL(getPublicOrigin()).hostname}`;
    const title = "Apoyo para entrega en biblioteca";
    const body = `Hola, ${notice.contactName}. Las publicaciones de esta orden están listas para recoger. Agradecemos tu apoyo para entregarlas a la persona indicada.`;
    const rows = details.map(([label, value]) => `<tr><td style="padding:8px 12px;font-size:12px;color:#666674">${escapeHtml(label)}</td><td style="padding:8px 12px;font-size:12px;font-weight:600">${escapeHtml(value)}</td></tr>`).join("");
    const publications = items.map((item) => `<li style="margin:6px 0">${item.quantity} × ${escapeHtml(item.title)}</li>`).join("");
    const html = emailShell(`${emailHeading(`Orden ${formatOrderNumber(order.orderNumber)}`, title, logoCid)}<p style="font-size:13px;line-height:1.7">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5effc;border-radius:8px">${rows}</table><h2 style="font-size:13px;margin:18px 0 8px">Publicaciones para entregar</h2><ul style="padding-left:18px;font-size:12px;line-height:1.6">${publications}</ul><p style="font-size:12px;line-height:1.7;color:#666674">Verifica el documento de identidad antes de entregar. Para coordinar, responde a este correo; no necesitas ingresar al sistema.</p>${emailAction(`mailto:${process.env.GOOGLE_OWNER_EMAIL ?? ""}`, "Contactar Fondo Editorial")}`);
    const text = `${title}\nOrden ${formatOrderNumber(order.orderNumber)}\n${body}\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\n${items.map((item) => `${item.quantity} × ${item.title}`).join("\n")}\nResponde a este correo para coordinar con Fondo Editorial.`;
    const sent = await sendPickupSupportEmail(tracking, notice.contactEmail, notice.id, notice.createdAt, html, text);
    accepted = true;
    await withDatabase((db) => db.update(pickupNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id, gmailThreadId: sent.threadId }).where(eq(pickupNotifications.id, id)));
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
