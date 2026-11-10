import { withDatabase, withReadDatabase } from "@/db";
import { cajaNotifications, cajaRequests, orders, treasuryMailboxes, treasuryObservations } from "@/db/schema";
import { readSentMailHeaders } from "@/integrations/google/gmail";
import { renderCajaNotice } from "@/modules/treasury/application/email-template";
import { sendCajaEmail } from "@/modules/treasury/application/email-sender";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { getTrackedOrder } from "@/modules/orders/data/tracking";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber, formatRequestNumber } from "@/modules/orders/domain/number";
import { getPublicOrigin } from "@/shared/config/application";
import { getMailProvider } from "@/shared/config/mail";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import "server-only";

export async function deliverCajaEmail(id: string, notificationId: string): Promise<boolean> {
  const leaseId = randomUUID();
  let accepted = false;
  try {
    const [event] = await withDatabase((db) => db.transaction(async (tx) => {
      const [request] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id)).for("update");
      if (!request) return [];
      const [notification] = await tx.select({ eventType: cajaNotifications.eventType }).from(cajaNotifications).where(and(eq(cajaNotifications.id, notificationId), eq(cajaNotifications.requestId, id)));
      if (notification?.eventType === "ASIGNACION") {
        await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(and(eq(cajaNotifications.id, notificationId), eq(cajaNotifications.status, "NO_ENVIADO"), eq(cajaNotifications.attempts, 0)));
        return [];
      }
      const busy = request.leaseUntil && request.leaseUntil > new Date();
      const events = await tx.update(cajaNotifications).set({ status: busy ? "ERROR" : "ENVIANDO", attempts: 1, lastAttemptAt: new Date() }).where(and(eq(cajaNotifications.id, notificationId), eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "NO_ENVIADO"), eq(cajaNotifications.attempts, 0))).returning();
      if (busy || !events.length) return [];
      await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(eq(cajaRequests.id, id));
      return events;
    }));
    if (!event) return false;
    if (event.eventType === "ASIGNACION") {
      await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id)));
      return false;
    }
    const provider = getMailProvider();
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
    if (provider === "gmail" && request.gmailThreadId && (!request.lastRfcMessageId || !request.subjectHeader)) {
      const [previous] = await withReadDatabase((db) => db.select().from(cajaNotifications).where(and(eq(cajaNotifications.requestId, id), eq(cajaNotifications.status, "ENVIADO"), isNotNull(cajaNotifications.gmailMessageId))).orderBy(desc(cajaNotifications.createdAt), desc(cajaNotifications.id)).limit(1));
      if (!previous?.gmailMessageId) throw new Error("GMAIL_THREAD_UNAVAILABLE");
      const real = await readSentMailHeaders(previous.gmailMessageId);
      if (real.threadId !== request.gmailThreadId) throw new Error("GMAIL_THREAD_MISMATCH");
      request.subjectHeader = real.subjectHeader;
      request.lastRfcMessageId = real.rfcMessageId;
      request.rfcReferences = [...new Set([...request.rfcReferences, real.rfcMessageId])].slice(-10);
    }
    const tracking = await getTrackedOrder(order.trackingToken); if (!tracking) throw new Error("ORDER_UNAVAILABLE");
    if (order.orderStatus === "CANCELADO" && event.eventType !== "ANULADA") { await withDatabase((db) => db.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id))); return false; }
    const cashLink = new URL(`/tesoreria-recaudacion/${request.id}`, getPublicOrigin()).toString();
    const logoCid = `brand-caja-${event.id}@${new URL(getPublicOrigin()).hostname}`;
    const notice = renderCajaNotice({
      orderNumber: formatOrderNumber(order.orderNumber), requestNumber: formatRequestNumber(request.requestNumber),
      imprint: request.publisherImprint, invoice: Boolean(order.billingRuc), assignedName: request.assignedName,
      customerName: order.customerName, customerDocument: order.customerDocument, customerPhone: order.customerPhone,
      billingRuc: order.billingRuc, billingBusinessName: order.billingBusinessName, billingAddress: order.billingAddress,
      amount: formatMoney(toCents(request.publisherImprint === "universidad" ? order.totalUniversidad : order.totalInstituto)),
      eventType: event.eventType, reason: event.reason, link: cashLink, logoCid,
    });
    const ready = await withDatabase((db) => db.transaction(async (tx) => {
      const [liveOrder] = await tx.select({ status: orders.orderStatus }).from(orders).where(eq(orders.id, order.id)).for("update");
      const [liveEvent] = await tx.select().from(cajaNotifications).where(eq(cajaNotifications.id, event.id)).for("update");
      if (!liveEvent || ["ENVIADO", "OMITIDO"].includes(liveEvent.status)) return false;
      if (liveOrder.status === "CANCELADO" && event.eventType !== "ANULADA") { await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(eq(cajaNotifications.id, event.id)); return false; }
      return liveEvent.status === "ENVIANDO";
    }));
    if (!ready) return false;
    const sent = await sendCajaEmail(tracking, {
      to: responsibles.map((person) => person.email),
      subject: provider === "gmail" && request.gmailThreadId ? request.subjectHeader ?? notice.subject : notice.subject,
      threadId: provider === "gmail" ? request.gmailThreadId : null,
      lastRfcMessageId: provider === "gmail" ? request.lastRfcMessageId : null,
      references: provider === "gmail" ? request.rfcReferences : [],
    }, event.id, notice.html, notice.text, event.createdAt);
    accepted = true;
    await withDatabase((db) => db.transaction(async (tx) => {
      await tx.update(cajaNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id, provider: sent.provider, providerMessageId: sent.providerMessageId, lastAttemptAt: null }).where(eq(cajaNotifications.id, event.id));
      if (sent.provider === "gmail" && sent.threadId) await tx.update(cajaRequests).set({ updatedAt: sql`${cajaRequests.updatedAt}`, gmailThreadId: request.gmailThreadId ?? sent.threadId }).where(and(eq(cajaRequests.id, id), eq(cajaRequests.leaseId, leaseId)));
    }));
    if (sent.provider === "gmail" && sent.id && sent.threadId) try {
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
