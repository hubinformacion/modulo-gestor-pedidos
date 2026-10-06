import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { authorizedEmails, books, campuses, orderActivity, orderEmails, orderItems, orders, user } from "@/db/schema";
import { resolveOrderLocation } from "./location";
import { trackingTokenSchema } from "./submission";

export async function getTrackedOrder(token: unknown) {
  const valid = trackingTokenSchema.safeParse(token);
  if (!valid.success) return null;
  return withReadDatabase(async (db) => {
    const [record] = await db.select({ order: orders, campus: campuses }).from(orders).leftJoin(campuses, eq(orders.deliveryCampus, campuses.id)).where(eq(orders.trackingToken, valid.data));
    if (!record) return null;
    const order = resolveOrderLocation(record.order, record.campus);
    const [items, mail, handler, activity] = await Promise.all([
      db.select({ title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, publisherImprint: orderItems.publisherImprint, unitPrice: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, order.id)).orderBy(asc(books.title)),
      db.select().from(orderEmails).where(eq(orderEmails.orderId, order.id)),
      order.assignedTo ? db.select({ email: user.email }).from(user).innerJoin(authorizedEmails, eq(authorizedEmails.email, user.email)).where(and(eq(user.id, order.assignedTo), eq(user.emailVerified, true), eq(authorizedEmails.role, "gestor"))).limit(1) : Promise.resolve([]),
      db.select({ eventType: orderActivity.eventType, detail: orderActivity.detail, createdAt: orderActivity.createdAt }).from(orderActivity).where(and(eq(orderActivity.orderId, order.id), sql`${orderActivity.eventType} IN ('PEDIDO_RECIBIDO', 'COMPROBANTE_RECIBIDO', 'PAGO_VERIFICADO', 'PAGO_RECHAZADO', 'DESPACHADO', 'ENTREGADO')`)).orderBy(desc(orderActivity.createdAt)).limit(30),
    ]);
    return { order, items, emailStatus: mail[0]?.status ?? "PENDIENTE", emailThreadId: mail[0]?.gmailThreadId ?? null, emailMessageId: mail[0]?.gmailMessageId ?? null, emailRfcMessageId: mail[0]?.rfcMessageId ?? null,
      emailSubjectHeader: mail[0]?.subjectHeader ?? null, emailLastRfcMessageId: mail[0]?.lastRfcMessageId ?? null, emailReferences: mail[0]?.rfcReferences ?? [], emailHeadersVerified: mail[0]?.headersVerified ?? false, emailThreadIssue: mail[0]?.threadIssue ?? null, handlerEmail: handler[0]?.email ?? null, activity,
    };
  });
}
