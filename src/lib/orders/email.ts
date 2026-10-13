import "server-only";
import { readSaleBatch, salePdfBytes, StaleDocumentBatch } from "@/lib/caja/service";
import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderEmails, orderNotifications, orders } from "@/db/schema";
import { readSentMailHeaders, sendOrderConfirmationEmail, sendOrderUpdateEmail } from "@/lib/google";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";
import { getTrackedOrder } from "./tracking";

// Verify Gmail's actual headers, not the Message-ID we hoped it would preserve.
// This helper only reads metadata; it never sends a message.
export async function synchronizeOrderThread(token: string): Promise<boolean> {
  const tracking = await getTrackedOrder(token);
  if (!tracking || !tracking.emailMessageId) return false;
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

// Only the ID created by the current mutation is accepted. No queue scans,
// handoffs, page recovery or retries of previous events.
export async function deliverOrderEmail(token: string, notificationId: string | null): Promise<boolean> {
  const leaseId = randomUUID();
  let orderId: string | undefined;
  let accepted = false;
  try {
    const tracking = await getTrackedOrder(token);
    if (!tracking) return false;
    orderId = tracking.order.id;
    const claim = await withDatabase((db) => db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId!)).for("update");
      const [mail] = await tx.select().from(orderEmails).where(eq(orderEmails.orderId, order.id)).for("update");
      if (!mail) return null;
      const [event] = notificationId ? await tx.select().from(orderNotifications).where(and(eq(orderNotifications.id, notificationId), eq(orderNotifications.orderId, order.id))).for("update") : [];
      if (notificationId && (!event || event.status !== "NO_ENVIADO" || event.attempts !== 0 || event.eventType === "ASIGNADO")) return null;
      if (!notificationId && (mail.status !== "NO_ENVIADO" || mail.attempts !== 0)) return null;
      const busy = mail.leaseUntil && mail.leaseUntil > new Date();
      const obsolete = order.orderStatus === "CANCELADO" && (!event || event.eventType !== "CANCELADO");
      const state = { status: obsolete ? "OMITIDO" : busy ? "ERROR" : "ENVIANDO", attempts: 1, lastAttemptAt: new Date() };
      if (event) await tx.update(orderNotifications).set(state).where(eq(orderNotifications.id, event.id));
      else await tx.update(orderEmails).set({ ...state, status: obsolete ? "NO_ENVIADO" : state.status }).where(eq(orderEmails.orderId, order.id));
      if (busy || obsolete) return null;
      await tx.update(orderEmails).set({ leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(eq(orderEmails.orderId, order.id));
      return { event };
    }));
    if (!claim) return false;
    if (claim.event && tracking.emailMessageId && !await synchronizeOrderThread(token)) throw new Error("GMAIL_THREAD_UNAVAILABLE");
    const current = await getTrackedOrder(token);
    if (!current) throw new Error("ORDER_UNAVAILABLE");
    const event = claim.event;
    const attachments = event?.eventType === "DOCUMENTOS_VENTA" ? await Promise.all((await readSaleBatch(current.order.id, event.payload.batchId)).map(async ({ document }) => ({ filename: document.fileName, content: await salePdfBytes(document.driveFileId, document.contentHash) }))) : undefined;
    const sent = event ? await sendOrderUpdateEmail(current, event, attachments) : await sendOrderConfirmationEmail(current);
    accepted = true; // Never submit again after Gmail accepted the message.
    await withDatabase((db) => db.transaction(async (tx) => {
      if (event) await tx.update(orderNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id }).where(eq(orderNotifications.id, event.id));
      if (!event || !current.emailMessageId) await tx.update(orderEmails).set({ ...(!event ? { status: "ENVIADO", sentAt: new Date() } : {}), gmailMessageId: sent.id, gmailThreadId: sent.threadId, headersVerified: false }).where(eq(orderEmails.orderId, current.order.id));
    }));
    await synchronizeOrderThread(token); // Metadata only; failure never resends.
    return true;
  } catch (error) {
    if (orderId && !accepted) {
      try {
        await withDatabase(async (db) => {
          if (notificationId) await db.update(orderNotifications).set({ status: error instanceof StaleDocumentBatch ? "OMITIDO" : "ERROR" }).where(and(eq(orderNotifications.id, notificationId), eq(orderNotifications.orderId, orderId!), eq(orderNotifications.status, "ENVIANDO")));
          else await db.update(orderEmails).set({ status: "ERROR" }).where(and(eq(orderEmails.orderId, orderId!), eq(orderEmails.status, "ENVIANDO")));
        });
      } catch (persistError) { reportServerError("order.mail.audit", persistError); }
    }
    reportServerError("order.mail.immediate", error);
    return accepted;
  } finally {
    if (orderId) {
      try { await withDatabase((db) => db.update(orderEmails).set({ leaseId: null, leaseUntil: null }).where(and(eq(orderEmails.orderId, orderId!), eq(orderEmails.leaseId, leaseId)))); }
      catch (error) { reportServerError("order.mail.release", error); }
    }
  }
}
