import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { authorizedEmails, cajaNotifications, cajaRequests, orders } from "@/db/schema";
import { readSentMailHeaders, sendCajaEmail } from "@/lib/google";
import { emailAction, emailShell, emailStateHeading, escapeHtml } from "@/lib/orders/email-template";
import { getTrackedOrder } from "@/lib/orders/tracking";
import { getPublicOrigin } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { imprintNames } from "@/lib/orders/types";
import { reportServerError } from "@/lib/server-diagnostics";

async function runCajaPass(id: string) {
  const started = Date.now();
  const [eligible] = await withReadDatabase((db) => db.select({ id: cajaNotifications.id }).from(cajaNotifications).where(and(eq(cajaNotifications.requestId, id), or(and(and(ne(cajaNotifications.status, "ENVIADO"), ne(cajaNotifications.status, "OMITIDO")), lt(cajaNotifications.attempts, 5)), and(eq(cajaNotifications.status, "ENVIADO"), isNull(cajaNotifications.rfcMessageId))), or(isNull(cajaNotifications.lastAttemptAt), lt(cajaNotifications.lastAttemptAt, new Date(Date.now() - 180_000))))).limit(1));
  if (!eligible) return;
  const leaseId = randomUUID();
  const [leased] = await withDatabase((db) => db.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(and(eq(cajaRequests.id, id), or(isNull(cajaRequests.leaseUntil), lt(cajaRequests.leaseUntil, new Date())))).returning());
  if (!leased) return;
  try {
    for (let i = 0; i < 10 && Date.now() - started < 50_000; i++) {
      // Recover metadata before the next reply. Accepted mail is never resent
      // because its Message-ID could not yet be read.
      const [unverified] = await withReadDatabase((db) => db.select().from(cajaNotifications).where(and(eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "ENVIADO"), isNull(cajaNotifications.rfcMessageId))).orderBy(asc(cajaNotifications.createdAt), asc(cajaNotifications.id)).limit(1));
      if (unverified?.gmailMessageId) {
        if (unverified.lastAttemptAt && Date.now() - unverified.lastAttemptAt.getTime() < 30_000) break;
        try {
          const real = await readSentMailHeaders(unverified.gmailMessageId);
          await withDatabase((db) => db.transaction(async (tx) => {
            const [thread] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id));
            if (thread.gmailThreadId && thread.gmailThreadId !== real.threadId) throw new Error("CAJA_THREAD_MISMATCH");
            await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, gmailThreadId: real.threadId, subjectHeader: real.subjectHeader, lastRfcMessageId: real.rfcMessageId, rfcReferences: [...new Set([...thread.rfcReferences, real.rfcMessageId])].slice(-10) }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)));
            await tx.update(cajaNotifications).set({ rfcMessageId: real.rfcMessageId }).where(eq(cajaNotifications.id, unverified.id));
          }));
        } catch (error) { await withDatabase((db) => db.update(cajaNotifications).set({ lastAttemptAt: new Date() }).where(eq(cajaNotifications.id, unverified.id))); reportServerError("caja.mail.metadata", error); break; }
      }
      const [event] = await withReadDatabase((db) => db.select().from(cajaNotifications).where(and(eq(cajaNotifications.requestId, id), and(ne(cajaNotifications.status, "ENVIADO"), ne(cajaNotifications.status, "OMITIDO")))).orderBy(asc(cajaNotifications.createdAt), asc(cajaNotifications.id)).limit(1));
      if (!event) break;
      if (event.attempts >= 5 || (event.lastAttemptAt && Date.now() - event.lastAttemptAt.getTime() < (event.status === "ENVIANDO" ? 180_000 : 60_000))) break;
      const { request, order, responsible } = await withReadDatabase(async (db) => {
        const [row] = await db.select({ request: cajaRequests, order: orders }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(eq(cajaRequests.id, id));
        const [responsible] = await db.select({ email: authorizedEmails.email }).from(authorizedEmails).where(and(eq(authorizedEmails.role, "caja"), eq(authorizedEmails.publisherImprint, row.request.publisherImprint)));
        return { ...row, responsible };
      });
      if (!responsible) break; // Durable request, no invented recipient.
      const tracking = await getTrackedOrder(order.trackingToken); if (!tracking) break;
      if (order.orderStatus === "CANCELADO" && event.eventType !== "ANULADA") { await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id))); continue; }
      const title = event.eventType === "ANULADA" ? "Solicitud anulada" : event.eventType === "SOLICITUD" ? `Emisión de ${order.billingRuc ? "factura" : "boleta"}` : event.eventType === "DEVUELTA" ? "Corrección solicitada" : "Documento de venta finalizado";
      const body = event.eventType === "ANULADA" ? `El pedido fue anulado. No continúes la emisión. Motivo: ${event.reason ?? "Pedido cancelado."} Los documentos ya emitidos se revisan por separado con Fondo Editorial.` : event.eventType === "SOLICITUD" ? "Fondo Editorial verificó el pago. Revisa los datos y comprobantes de la solicitud, adjunta el PDF y finaliza la emisión." : event.eventType === "DEVUELTA" ? `Fondo Editorial solicita corregir el documento: ${event.reason ?? "Revisa los datos."}` : "Caja finalizó la solicitud y confirmó el PDF. El documento está disponible en el detalle del pedido. Su envío al comprador es automático cuando están finalizados todos los documentos requeridos.";
      const cashLink = new URL(`/caja/${request.id}`, getPublicOrigin()).toString();
      const adminLink = new URL(`/admin/pedidos/${order.id}`, getPublicOrigin()).toString();
      const amount = formatMoney(toCents(request.publisherImprint === "universidad" ? order.totalUniversidad : order.totalInstituto));
      const details = [["Sello editorial", imprintNames[request.publisherImprint]], ["Comprador", order.customerName], [order.billingRuc ? "RUC" : "Documento", order.billingRuc ?? order.customerDocument], ...(order.billingBusinessName ? [["Razón social", order.billingBusinessName]] : []), ["Importe", amount]];
      const artCid = `caja-${event.id}@${new URL(getPublicOrigin()).hostname}`;
      const html = emailShell(`${emailStateHeading(`Caja · Pedido ${order.orderNumber} · Revisión ${event.cycle}`, title, artCid)}<p style="font-size:13px;line-height:1.9">${escapeHtml(body)}</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#faf8fd;border-radius:8px">${details.map(([label, value]) => `<tr><td style="padding:10px 14px;font-size:12px;color:#666674">${escapeHtml(label)}</td><td style="padding:10px 14px;font-size:12px;font-weight:600;text-align:right">${escapeHtml(value)}</td></tr>`).join("")}</table>${emailAction(event.eventType === "FINALIZADA" ? adminLink : cashLink, event.eventType === "FINALIZADA" ? "Revisar documento" : "Abrir solicitud")}${event.eventType === "FINALIZADA" ? `<p style="font-size:12px;text-align:center"><a href="${escapeHtml(cashLink)}" style="color:#6802c1">Consultar solicitud de caja</a></p>` : ""}<p style="font-size:11px;color:#666674;line-height:1.8">Comunicación interna de caja y atención editorial. Este aviso no se envía al comprador.</p>`);
      const ready = await withDatabase((db) => db.transaction(async (tx) => {
        const [liveOrder] = await tx.select({ status: orders.orderStatus }).from(orders).where(eq(orders.id, order.id)).for("update");
        const [liveEvent] = await tx.select().from(cajaNotifications).where(eq(cajaNotifications.id, event.id)).for("update");
        if (!liveEvent || ["ENVIADO", "OMITIDO"].includes(liveEvent.status)) return false;
        if (liveOrder.status === "CANCELADO" && event.eventType !== "ANULADA") { await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id)); return false; }
        await tx.update(cajaNotifications).set({ status: "ENVIANDO", attempts: liveEvent.attempts + 1, lastAttemptAt: new Date() }).where(eq(cajaNotifications.id, event.id)); return true;
      }));
      if (!ready) continue;
      try {
        const sent = await sendCajaEmail(tracking, { to: responsible.email, subject: request.subjectHeader ?? `Caja · Pedido ${order.orderNumber} · ${imprintNames[request.publisherImprint]}`, threadId: request.gmailThreadId, lastRfcMessageId: request.lastRfcMessageId, references: request.rfcReferences }, event.id, html, `${title}\n${body}\n${details.map(([label, value]) => `${label}: ${value}`).join("\n")}\nCaja: ${cashLink}\nFondo Editorial: ${adminLink}`, event.eventType === "SOLICITUD" ? "review" : event.eventType === "FINALIZADA" ? "verified" : "rejected", event.createdAt);
        await withDatabase((db) => db.update(cajaNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id, lastAttemptAt: null }).where(eq(cajaNotifications.id, event.id)));
        // The next iteration verifies this message before sending another.
      } catch (error) { await withDatabase((db) => db.update(cajaNotifications).set({ status: "ERROR" }).where(and(eq(cajaNotifications.id, event.id), ne(cajaNotifications.status, "ENVIADO")))); reportServerError("caja.mail.send", error); break; }
    }
  } finally { await withDatabase((db) => db.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, leaseId: null, leaseUntil: null }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)))); }
}
export async function deliverCajaEmail(id: string) {
  try {
    // Bounded handoff covers events committed as the previous pass drained.
    await runCajaPass(id);
    await runCajaPass(id);
  } catch (error) { reportServerError("caja.mail.pending", error); }
}
export async function recoverCajaMail(resetExhausted = false) {
  try {
    if (resetExhausted) await withDatabase((db) => db.update(cajaNotifications).set({ status: "PENDIENTE", attempts: 0, lastAttemptAt: null }).where(and(eq(cajaNotifications.status, "ERROR"), gte(cajaNotifications.attempts, 5), lt(cajaNotifications.lastAttemptAt, new Date(Date.now() - 3600_000)))));
    const pending = await withReadDatabase((db) => db.selectDistinct({ id: cajaRequests.id }).from(cajaRequests).innerJoin(cajaNotifications, eq(cajaNotifications.requestId, cajaRequests.id)).innerJoin(authorizedEmails, and(eq(authorizedEmails.publisherImprint, cajaRequests.publisherImprint), eq(authorizedEmails.role, "caja"))).where(and(or(isNull(cajaRequests.leaseUntil), lt(cajaRequests.leaseUntil, new Date())), or(and(and(ne(cajaNotifications.status, "ENVIADO"), ne(cajaNotifications.status, "OMITIDO")), lt(cajaNotifications.attempts, 5)), and(eq(cajaNotifications.status, "ENVIADO"), isNull(cajaNotifications.rfcMessageId))), or(isNull(cajaNotifications.lastAttemptAt), lt(cajaNotifications.lastAttemptAt, new Date(Date.now() - 180_000))))).limit(10));
    const started = Date.now(); let processed = 0;
    for (const row of pending) { if (Date.now() - started > 50_000) break; await deliverCajaEmail(row.id); processed++; }
    return processed;
  } catch (error) { reportServerError("caja.mail.recovery", error); return 0; }
}
