import "server-only";
import { asc, eq, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, orderEmails, orderItems, orders, paymentReceipts } from "@/db/schema";
import { trackingTokenSchema } from "./submission";

export async function getTrackedOrder(token: unknown) {
  const valid = trackingTokenSchema.safeParse(token);
  if (!valid.success) return null;
  return withDatabase(async (db) => {
    const [order] = await db.select().from(orders).where(eq(orders.trackingToken, valid.data));
    if (!order) return null;
    const [items, receipts, mail] = await Promise.all([
      db.select({ title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, publisherImprint: orderItems.publisherImprint, unitPrice: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, order.id)).orderBy(asc(books.title)),
      db.select({ id: paymentReceipts.id, publisherImprint: paymentReceipts.publisherImprint, fileName: paymentReceipts.fileName, uploadedAt: paymentReceipts.uploadedAt }).from(paymentReceipts).where(eq(paymentReceipts.orderId, order.id)).orderBy(asc(paymentReceipts.uploadedAt)),
      db.select({ status: orderEmails.status, attempts: orderEmails.attempts }).from(orderEmails).where(eq(orderEmails.orderId, order.id)),
    ]);
    return { order, items, receipts, emailStatus: mail[0]?.status ?? "PENDIENTE" };
  });
}
