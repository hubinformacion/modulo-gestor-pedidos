import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { authorizedEmails, books, orderActivity, orderEmails, orderItems, orders, user } from "@/db/schema";
import { trackingTokenSchema } from "./submission";

export async function getTrackedOrder(token: unknown) {
  const valid = trackingTokenSchema.safeParse(token);
  if (!valid.success) return null;
  return withReadDatabase(async (db) => {
    const [order] = await db.select().from(orders).where(eq(orders.trackingToken, valid.data));
    if (!order) return null;
    const [items, mail, handler, activity] = await Promise.all([
      db.select({ title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, publisherImprint: orderItems.publisherImprint, unitPrice: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, order.id)).orderBy(asc(books.title)),
      db.select().from(orderEmails).where(eq(orderEmails.orderId, order.id)),
      order.assignedTo ? db.select({ email: user.email }).from(user).innerJoin(authorizedEmails, eq(authorizedEmails.email, user.email)).where(and(eq(user.id, order.assignedTo), eq(user.emailVerified, true))).limit(1) : Promise.resolve([]),
      db.select({ eventType: orderActivity.eventType, detail: orderActivity.detail, createdAt: orderActivity.createdAt }).from(orderActivity).where(and(eq(orderActivity.orderId, order.id), sql`${orderActivity.eventType} NOT IN ('ASIGNADO', 'LIBERADO')`)).orderBy(desc(orderActivity.createdAt)).limit(30),
    ]);
    return { order, items, emailStatus: mail[0]?.status ?? "PENDIENTE", emailThreadId: mail[0]?.gmailThreadId ?? null, emailMessageId: mail[0]?.gmailMessageId ?? null, emailRfcMessageId: mail[0]?.rfcMessageId ?? null,
      emailSubjectHeader: mail[0]?.subjectHeader ?? null, emailLastRfcMessageId: mail[0]?.lastRfcMessageId ?? null, emailReferences: mail[0]?.rfcReferences ?? [], emailHeadersVerified: mail[0]?.headersVerified ?? false, emailThreadIssue: mail[0]?.threadIssue ?? null, handlerEmail: handler[0]?.email ?? null, activity,
    };
  });
}
