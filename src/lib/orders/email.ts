import "server-only";
import { beginSaleDelivery, readSaleBatch, salePdfBytes, StaleDocumentBatch } from "@/lib/caja/service";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lt, ne, or } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderEmails, orderNotifications, orders } from "@/db/schema";
import { readSentMailHeaders, sendOrderConfirmationEmail, sendOrderUpdateEmail } from "@/lib/google";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";
import { getTrackedOrder } from "./tracking";

// Verify Gmail's actual headers, not the Message-ID we hoped it would preserve.
// This helper only reads metadata; it never sends a message.
export async function synchronizeOrderThread(token: string): Promise<boolean> {
  const tracking = await getTrackedOrder(token);
  if (!tracking || tracking.emailStatus !== "ENVIADO" || !tracking.emailMessageId) return false;
  try {
    if (!tracking.emailHeadersVerified) {
      const headers = await readSentMailHeaders(tracking.emailMessageId);
      await withDatabase((db) => db.update(orderEmails).set({ gmailThreadId: headers.threadId, rfcMessageId: headers.rfcMessageId, subjectHeader: headers.subjectHeader, headersVerified: true, lastRfcMessageId: headers.rfcMessageId, rfcReferences: [headers.rfcMessageId], threadIssue: null }).where(and(eq(orderEmails.orderId, tracking.order.id), eq(orderEmails.headersVerified, false))));
    }
    const [latest] = await withDatabase((db) => db.select().from(orderNotifications).where(and(eq(orderNotifications.orderId, tracking.order.id), eq(orderNotifications.status, "ENVIADO"))).orderBy(desc(orderNotifications.createdAt), desc(orderNotifications.id)).limit(1));
    if (latest?.gmailMessageId && !latest.rfcMessageId) {
      const headers = await readSentMailHeaders(latest.gmailMessageId);
      const current = await getTrackedOrder(token);
      if (headers.threadId === current?.emailThreadId) {
        await withDatabase((db) => db.transaction(async (tx) => {
          await tx.update(orderNotifications).set({ rfcMessageId: headers.rfcMessageId }).where(eq(orderNotifications.id, latest.id));
          await tx.update(orderEmails).set({ lastRfcMessageId: headers.rfcMessageId, rfcReferences: [...new Set([...(current?.emailReferences ?? []), headers.rfcMessageId])].slice(-10), threadIssue: null }).where(eq(orderEmails.orderId, tracking.order.id));
        }));
      }
      else await withDatabase((db) => db.update(orderNotifications).set({ rfcMessageId: headers.rfcMessageId }).where(eq(orderNotifications.id, latest.id)));
      // Older updates that already went to another thread are never resent.
    }
    return true;
  } catch (error) {
    const issue = safeErrorDetails(error).status === 403 ? "GMAIL_METADATA_PERMISSION_REQUIRED" : "GMAIL_HEADERS_UNAVAILABLE";
    await withDatabase((db) => db.update(orderEmails).set({ threadIssue: issue, lastAttemptAt: new Date() }).where(eq(orderEmails.orderId, tracking.order.id)));
    reportServerError("order.mail.headers", error);
    return false;
  }
}

// One lease per order serializes the initial message and all updates. Provider
// calls hold no business row locks, and state changes commit before delivery.
export async function deliverOrderEmail(token: string): Promise<boolean> {
  const started = Date.now();
  let sent = false;
  // Drain a handoff after releasing the lease. A concurrent status change can
  // commit just after the previous pass observed an empty queue.
  for (let pass = 0; pass < 3 && Date.now() - started < 60_000; pass++) {
    const outcome = await deliverOrderPass(token, started);
    sent ||= outcome.sent;
    if (!outcome.again) break;
  }
  return sent;
}

async function deliverOrderPass(token: string, started: number): Promise<{ sent: boolean; again: boolean }> {
  const outcome = { sent: false, again: false };
  let threadReady = false;
  let acceptedInitialId: string | null = null;
  const tracking = await getTrackedOrder(token);
  if (!tracking) return outcome;
  const leaseId = randomUUID();
  const [leased] = await withDatabase((db) => db.update(orderEmails).set({ leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(and(eq(orderEmails.orderId, tracking.order.id), or(isNull(orderEmails.leaseUntil), lt(orderEmails.leaseUntil, new Date())))).returning());
  if (!leased) return outcome;
  try {
    if (leased.status !== "ENVIADO") {
      if (leased.attempts >= 5 || (leased.lastAttemptAt && Date.now() - leased.lastAttemptAt.getTime() < (leased.status === "ENVIANDO" ? 180_000 : 60_000))) return outcome;
      await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIANDO", attempts: leased.attempts + 1, lastAttemptAt: new Date() }).where(eq(orderEmails.orderId, tracking.order.id)));
      try {
        const sent = await sendOrderConfirmationEmail(tracking);
        // Accepted by Gmail: do not resend if the later metadata lookup fails.
        await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIADO", gmailMessageId: sent.id, gmailThreadId: sent.threadId, rfcMessageId: null, headersVerified: false, sentAt: new Date() }).where(eq(orderEmails.orderId, tracking.order.id)));
        acceptedInitialId = sent.id;
        outcome.sent = true;
      } catch (error) {
        await withDatabase((db) => db.update(orderEmails).set({ status: "ERROR" }).where(and(eq(orderEmails.orderId, tracking.order.id), ne(orderEmails.status, "ENVIADO"))));
        reportServerError("order.mail.initial", error); return outcome;
      }
    }
    if (acceptedInitialId && tracking.order.orderStatus === "CANCELADO") {
      try { await withDatabase((db) => db.update(orderNotifications).set({ status: "ENVIADO", gmailMessageId: acceptedInitialId! }).where(and(eq(orderNotifications.orderId, tracking.order.id), eq(orderNotifications.eventType, "CANCELADO"), eq(orderNotifications.status, "PENDIENTE")))); }
      catch (error) { reportServerError("order.cancel.mail.binding", error); } // Never regress the accepted root.
    }
    if (!await synchronizeOrderThread(token)) return outcome;
    threadReady = true;
    for (let index = 0; index < 20 && Date.now() - started < 60_000; index++) {
      const [event] = await withDatabase((db) => db.select().from(orderNotifications).where(and(eq(orderNotifications.orderId, tracking.order.id), ne(orderNotifications.eventType, "ASIGNADO"), and(ne(orderNotifications.status, "ENVIADO"), ne(orderNotifications.status, "OMITIDO")))).orderBy(asc(orderNotifications.createdAt), asc(orderNotifications.id)).limit(1));
      if (!event) break;
      if (event.attempts >= 5 || (event.lastAttemptAt && Date.now() - event.lastAttemptAt.getTime() < (event.status === "ENVIANDO" ? 180_000 : 60_000))) break;
      const current = await getTrackedOrder(token);
      if (!current) break;
      if (event.eventType === "DOCUMENTOS_VENTA") { if (!await beginSaleDelivery(event)) continue; }
      else if (!await beginOrderNotification(event)) continue;
      try {
        const attachments = event.eventType === "DOCUMENTOS_VENTA" ? await Promise.all((await readSaleBatch(current.order.id, event.payload.batchId)).map(async ({ document }) => ({ filename: document.fileName, content: await salePdfBytes(document.driveFileId, document.contentHash) }))) : undefined;
        const sent = await sendOrderUpdateEmail(current, event, attachments);
        await withDatabase((db) => db.update(orderNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id }).where(eq(orderNotifications.id, event.id)));
        outcome.sent = true;
        if (sent.threadId !== current.emailThreadId) { threadReady = false; await withDatabase((db) => db.update(orderEmails).set({ headersVerified: false, threadIssue: "GMAIL_THREAD_MISMATCH" }).where(eq(orderEmails.orderId, tracking.order.id))); break; }
        if (!await synchronizeOrderThread(token)) { threadReady = false; break; }
      } catch (error) {
        if (error instanceof StaleDocumentBatch) { await withDatabase((db) => db.update(orderNotifications).set({ status: "OMITIDO" }).where(eq(orderNotifications.id, event.id))); continue; }
        await withDatabase((db) => db.update(orderNotifications).set({ status: "ERROR" }).where(and(eq(orderNotifications.id, event.id), ne(orderNotifications.status, "ENVIADO"))));
        threadReady = false;
        reportServerError("order.mail.update", error); break;
      }
    }
    return outcome;
  } finally {
    const pending = await withDatabase((db) => db.transaction(async (tx) => {
      const released = await tx.update(orderEmails).set({ leaseId: null, leaseUntil: null }).where(and(eq(orderEmails.orderId, tracking.order.id), eq(orderEmails.leaseId, leaseId))).returning({ id: orderEmails.orderId });
      if (!released.length || !threadReady) return false;
      const [next] = await tx.select({ id: orderNotifications.id }).from(orderNotifications).where(and(
        eq(orderNotifications.orderId, tracking.order.id), and(ne(orderNotifications.status, "ENVIADO"), ne(orderNotifications.status, "OMITIDO")), ne(orderNotifications.eventType, "ASIGNADO"), lt(orderNotifications.attempts, 5),
        or(isNull(orderNotifications.lastAttemptAt), and(ne(orderNotifications.status, "ENVIANDO"), lt(orderNotifications.lastAttemptAt, new Date(Date.now() - 60_000))), and(eq(orderNotifications.status, "ENVIANDO"), lt(orderNotifications.lastAttemptAt, new Date(Date.now() - 180_000)))),
      )).limit(1);
      return Boolean(next);
    }));
    outcome.again = pending && Date.now() - started < 60_000;
  }
}

async function beginOrderNotification(event: typeof orderNotifications.$inferSelect) {
  return withDatabase((db) => db.transaction(async (tx) => {
    const [order] = await tx.select({ status: orders.orderStatus }).from(orders).where(eq(orders.id, event.orderId)).for("update");
    const [current] = await tx.select().from(orderNotifications).where(eq(orderNotifications.id, event.id)).for("update");
    if (!current || ["ENVIADO", "OMITIDO"].includes(current.status)) return false;
    if (order.status === "CANCELADO" && event.eventType !== "CANCELADO") { await tx.update(orderNotifications).set({ status: "OMITIDO" }).where(eq(orderNotifications.id, event.id)); return false; }
    await tx.update(orderNotifications).set({ status: "ENVIANDO", attempts: current.attempts + 1, lastAttemptAt: new Date() }).where(eq(orderNotifications.id, event.id));
    return true;
  }));
}
