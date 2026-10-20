import "server-only";
import { formatRequestNumber } from "@/lib/orders/number";
import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { treasuryMailboxes, treasuryObservations, cajaNotifications, cajaRequests, orders } from "@/db/schema";
import { readSentMailHeaders, sendCajaEmail } from "@/lib/google";
import { emailAction, emailShell, emailStateHeading, escapeHtml } from "@/lib/orders/email-template";
import { getTrackedOrder } from "@/lib/orders/tracking";
import { getPublicOrigin } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { imprintNames } from "@/lib/orders/types";
import { reportServerError } from "@/lib/server-diagnostics";

export async function deliverCajaEmail(id: string, notificationId: string): Promise<boolean> {
  const leaseId = randomUUID();
  let accepted = false;
  try {
    const [event] = await withDatabase((db) => db.transaction(async (tx) => {
      const [request] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id)).for("update");
      if (!request) return [];
      const busy = request.leaseUntil && request.leaseUntil > new Date();
      const events = await tx.update(cajaNotifications).set({ status: busy ? "ERROR" : "ENVIANDO", attempts: 1, lastAttemptAt: new Date() }).where(and(eq(cajaNotifications.id, notificationId), eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "NO_ENVIADO"), eq(cajaNotifications.attempts, 0))).returning();
      if (busy || !events.length) return [];
      await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(eq(cajaRequests.id, id));
      return events;
    }));
    if (!event) return false;
    const { request, order, responsibles, configured } = await withReadDatabase(async (db) => {
      const [row] = await db.select({ request: cajaRequests, order: orders }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(eq(cajaRequests.id, id));
      const [mailbox] = await db.select({ email: treasuryMailboxes.email, eligible: sql<boolean>`${treasuryMailboxes.createdAt} <= (SELECT created_at FROM ${cajaNotifications} WHERE id = ${event.id})` }).from(treasuryMailboxes).where(eq(treasuryMailboxes.publisherImprint, row.request.publisherImprint));
      const corrections = await db.select().from(treasuryObservations).where(eq(treasuryObservations.requestId, row.request.id));
      const billing = corrections.filter((o) => o.resolvedAt && o.correction).sort((a, b) => a.resolvedAt!.getTime() - b.resolvedAt!.getTime()).reduce((data, o) => ({ ...data, ...o.correction }), {} as Record<string, string>);
      const correctedOrder = { ...row.order, customerName: billing.name ?? row.order.customerName, customerDocument: billing.document ?? row.order.customerDocument, customerPhone: billing.phone ?? row.order.customerPhone, billingRuc: billing.billingRuc !== undefined ? billing.billingRuc || null : row.order.billingRuc, billingBusinessName: billing.billingBusinessName ?? row.order.billingBusinessName, billingAddress: billing.billingAddress ?? row.order.billingAddress };
      return { ...row, order: correctedOrder, configured: mailbox ? [mailbox] : [], responsibles: mailbox && mailbox.eligible ? [mailbox] : [] };
    });
    if (!configured.length) { await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id))); return false; }
    if (!responsibles.length) {
      await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(and(eq(cajaNotifications.id, event.id), eq(cajaNotifications.status, "ENVIANDO"))));
      return false; // No recipient added after the event receives this message.
    }
    if (request.gmailThreadId && !request.lastRfcMessageId) {
      const [previous] = await withReadDatabase((db) => db.select().from(cajaNotifications).where(and(eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "ENVIADO"))).orderBy(desc(cajaNotifications.createdAt), desc(cajaNotifications.id)).limit(1));
      if (!previous?.gmailMessageId) throw new Error("GMAIL_THREAD_UNAVAILABLE");
      const real = await readSentMailHeaders(previous.gmailMessageId);
      if (real.threadId !== request.gmailThreadId) throw new Error("GMAIL_THREAD_MISMATCH");
      request.subjectHeader = real.subjectHeader;
      request.lastRfcMessageId = real.rfcMessageId;
      request.rfcReferences = [...new Set([...request.rfcReferences, real.rfcMessageId])].slice(-10);
    }
    const tracking = await getTrackedOrder(order.trackingToken); if (!tracking) throw new Error("ORDER_UNAVAILABLE");
    if (order.orderStatus === "CANCELADO" && event.eventType !== "ANULADA") { await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id))); return false; }
    if (event.eventType === "ASIGNACION" && (request.assignmentToken !== event.assignmentKey || ["FINALIZADA", "ANULADA"].includes(request.status))) {
      await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id)));
      return false;
    }
    const title = event.eventType === "ASIGNACION" ? "Responsable de atención asignado" : event.eventType === "ANULADA" ? "Solicitud anulada" : event.eventType === "SOLICITUD" ? `Emisión de ${order.billingRuc ? "factura" : "boleta"}` : event.eventType === "DEVUELTA" ? "Corrección solicitada" : "Documento de venta finalizado";
    const body = event.eventType === "ASIGNACION" ? event.reason ?? "Se asignó una persona responsable de Tesorería Recaudación a la solicitud." : event.eventType === "ANULADA" ? `El pedido fue anulado. No continúes la emisión. Motivo: ${event.reason ?? "Pedido cancelado."} Los documentos ya emitidos se revisan por separado con Fondo Editorial.` : event.eventType === "SOLICITUD" ? "Fondo Editorial verificó el pago. Revisa los datos y comprobantes de la solicitud, adjunta el PDF y finaliza la emisión." : event.eventType === "DEVUELTA" ? `Fondo Editorial solicita corregir el documento: ${event.reason ?? "Revisa los datos."}` : "El PDF está disponible en el detalle. El comprador lo recibirá cuando estén finalizados todos los documentos requeridos.";
    const cashLink = new URL(`/tesoreria-recaudacion/${request.id}`, getPublicOrigin()).toString();
    const amount = formatMoney(toCents(request.publisherImprint === "universidad" ? order.totalUniversidad : order.totalInstituto));
    const details = [["Unidad de negocio", imprintNames[request.publisherImprint]], ["Responsable de Tesorería Recaudación", request.assignedName ?? "Por asignar"], ["Comprador", order.customerName], ["Celular", order.customerPhone], ...(order.billingRuc ? [["Dirección fiscal", order.billingAddress ?? ""]] : []), [order.billingRuc ? "RUC" : "Documento", order.billingRuc ?? order.customerDocument], ...(order.billingBusinessName ? [["Razón social", order.billingBusinessName]] : []), ["Importe", amount]];
    const artCid = `caja-${event.id}@${new URL(getPublicOrigin()).hostname}`;
    const html = emailShell(`${emailStateHeading(`Tesorería Recaudación · Solicitud ${formatRequestNumber(request.requestNumber)}`, title, artCid)}<p style="font-size:13px;line-height:1.7">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8fd;border-radius:8px">${details.map(([label, value]) => `<tr><td style="padding:8px 12px;font-size:12px;color:#666674">${escapeHtml(label)}</td><td style="padding:8px 12px;font-size:12px;font-weight:600;text-align:right">${escapeHtml(value)}</td></tr>`).join("")}</table>${emailAction(cashLink, event.eventType === "FINALIZADA" ? "Revisar documento" : "Abrir solicitud")}<p style="font-size:11px;color:#666674;line-height:1.8">Comunicación interna de Tesorería Recaudación y atención editorial. Este aviso no se envía al comprador.</p>`);
    const ready = await withDatabase((db) => db.transaction(async (tx) => {
      const [liveOrder] = await tx.select({ status: orders.orderStatus }).from(orders).where(eq(orders.id, order.id)).for("update");
      const [liveEvent] = await tx.select().from(cajaNotifications).where(eq(cajaNotifications.id, event.id)).for("update");
      if (!liveEvent || ["ENVIADO", "OMITIDO"].includes(liveEvent.status)) return false;
      if (liveOrder.status === "CANCELADO" && event.eventType !== "ANULADA") { await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id)); return false; }
      if (event.eventType === "ASIGNACION") {
        const [liveRequest] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id)).for("update");
        if (!liveRequest || liveRequest.assignmentToken !== event.assignmentKey || ["FINALIZADA", "ANULADA"].includes(liveRequest.status)) {
          await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id));
          return false;
        }
      }
      return liveEvent.status === "ENVIANDO";
    }));
    if (!ready) return false;
    const sent = await sendCajaEmail(tracking, { to: responsibles.map((person) => person.email), subject: request.subjectHeader ?? `Solicitud de emisión de comprobante #${formatRequestNumber(request.requestNumber)} - Fondo Editorial`, threadId: request.gmailThreadId, lastRfcMessageId: request.lastRfcMessageId, references: request.rfcReferences }, event.id, html, `${title}\n${body}\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nTesorería Recaudación: ${cashLink}`, ["SOLICITUD", "ASIGNACION"].includes(event.eventType) ? "review" : event.eventType === "FINALIZADA" ? "verified" : "rejected", event.createdAt);
    accepted = true;
    await withDatabase((db) => db.transaction(async (tx) => {
      await tx.update(cajaNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id, lastAttemptAt: null }).where(eq(cajaNotifications.id, event.id));
      await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, gmailThreadId: request.gmailThreadId ?? sent.threadId }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)));
    }));
    try {
      const real = await readSentMailHeaders(sent.id);
      if (request.gmailThreadId && real.threadId !== request.gmailThreadId) throw new Error("GMAIL_THREAD_MISMATCH");
      await withDatabase((db) => db.transaction(async (tx) => {
        await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, gmailThreadId: real.threadId, subjectHeader: real.subjectHeader, lastRfcMessageId: real.rfcMessageId, rfcReferences: [...new Set([...request.rfcReferences, real.rfcMessageId])].slice(-10) }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)));
        await tx.update(cajaNotifications).set({ rfcMessageId: real.rfcMessageId }).where(eq(cajaNotifications.id, event.id));
      }));
    } catch (error) { reportServerError("caja.mail.metadata", error); }
    return true;
  } catch (error) {
    if (!accepted) {
      try { await withDatabase((db) => db.update(cajaNotifications).set({ status: "ERROR" }).where(and(eq(cajaNotifications.id, notificationId), eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "ENVIANDO")))); }
      catch (persistError) { reportServerError("caja.mail.audit", persistError); }
    }
    reportServerError("caja.mail.immediate", error);
    return accepted;
  } finally {
    try { await withDatabase((db) => db.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, leaseId: null, leaseUntil: null }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)))); }
    catch (error) { reportServerError("caja.mail.release", error); }
  }
}
