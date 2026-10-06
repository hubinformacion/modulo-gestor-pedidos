import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lt, ne, or } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orderEmails, orderNotifications } from "@/db/schema";
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
    await withDatabase((db) => db.update(orderEmails).set({ threadIssue: issue }).where(eq(orderEmails.orderId, tracking.order.id)));
    reportServerError("order.mail.headers", error);
    return false;
  }
}

// One lease per order serializes the initial message and all updates. Provider
// calls hold no business row locks, and state changes commit before delivery.
export async function deliverOrderEmail(token: string): Promise<boolean> {
  const started = Date.now();
  const tracking = await getTrackedOrder(token);
  if (!tracking) return false;
  const leaseId = randomUUID();
  const [leased] = await withDatabase((db) => db.update(orderEmails).set({ leaseId, leaseUntil: new Date(Date.now() + 300_000) }).where(and(eq(orderEmails.orderId, tracking.order.id), or(isNull(orderEmails.leaseUntil), lt(orderEmails.leaseUntil, new Date())))).returning());
  if (!leased) return false;
  let sentAny = false;
  try {
    if (leased.status !== "ENVIADO") {
      if (leased.attempts >= 5 || (leased.lastAttemptAt && Date.now() - leased.lastAttemptAt.getTime() < (leased.status === "ENVIANDO" ? 180_000 : 60_000))) return false;
      await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIANDO", attempts: leased.attempts + 1, lastAttemptAt: new Date() }).where(eq(orderEmails.orderId, tracking.order.id)));
      try {
        const sent = await sendOrderConfirmationEmail(tracking);
        // Accepted by Gmail: do not resend if the later metadata lookup fails.
        await withDatabase((db) => db.update(orderEmails).set({ status: "ENVIADO", gmailMessageId: sent.id, gmailThreadId: sent.threadId, rfcMessageId: null, headersVerified: false, sentAt: new Date() }).where(eq(orderEmails.orderId, tracking.order.id)));
        sentAny = true;
      } catch (error) {
        await withDatabase((db) => db.update(orderEmails).set({ status: "ERROR" }).where(eq(orderEmails.orderId, tracking.order.id)));
        reportServerError("order.mail.initial", error); return false;
      }
    }
    if (!await synchronizeOrderThread(token)) return sentAny;
    for (let index = 0; index < 3 && Date.now() - started < 60_000; index++) {
      const [event] = await withDatabase((db) => db.select().from(orderNotifications).where(and(eq(orderNotifications.orderId, tracking.order.id), ne(orderNotifications.status, "ENVIADO"))).orderBy(asc(orderNotifications.createdAt), asc(orderNotifications.id)).limit(1));
      if (!event) break;
      if (event.attempts >= 5 || (event.lastAttemptAt && Date.now() - event.lastAttemptAt.getTime() < (event.status === "ENVIANDO" ? 180_000 : 60_000))) break;
      const current = await getTrackedOrder(token);
      if (!current) break;
      await withDatabase((db) => db.update(orderNotifications).set({ status: "ENVIANDO", attempts: event.attempts + 1, lastAttemptAt: new Date() }).where(eq(orderNotifications.id, event.id)));
      try {
        const sent = await sendOrderUpdateEmail(current, event);
        await withDatabase((db) => db.update(orderNotifications).set({ status: "ENVIADO", gmailMessageId: sent.id }).where(eq(orderNotifications.id, event.id)));
        sentAny = true;
        if (sent.threadId !== current.emailThreadId) { await withDatabase((db) => db.update(orderEmails).set({ headersVerified: false, threadIssue: "GMAIL_THREAD_MISMATCH" }).where(eq(orderEmails.orderId, tracking.order.id))); break; }
        if (!await synchronizeOrderThread(token)) break;
      } catch (error) {
        await withDatabase((db) => db.update(orderNotifications).set({ status: "ERROR" }).where(eq(orderNotifications.id, event.id)));
        reportServerError("order.mail.update", error); break;
      }
    }
    return sentAny;
  } finally {
    await withDatabase((db) => db.update(orderEmails).set({ leaseId: null, leaseUntil: null }).where(and(eq(orderEmails.orderId, tracking.order.id), eq(orderEmails.leaseId, leaseId))));
  }
}
