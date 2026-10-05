import "server-only";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, orderEmails, orderItems, orderNotifications, orders, paymentReceipts } from "@/db/schema";
import { trackingTokenSchema } from "./submission";

export async function getTrackedOrder(token: unknown) {
  const valid = trackingTokenSchema.safeParse(token);
  if (!valid.success) return null;
  return withDatabase(async (db) => {
    const [order] = await db.select().from(orders).where(eq(orders.trackingToken, valid.data));
    if (!order) return null;
    const [items, receipts, mail, pendingNotifications] = await Promise.all([
      db.select({ title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, publisherImprint: orderItems.publisherImprint, unitPrice: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, order.id)).orderBy(asc(books.title)),
      db.select({ id: paymentReceipts.id, publisherImprint: paymentReceipts.publisherImprint, fileName: paymentReceipts.fileName, driveViewUrl: paymentReceipts.driveViewUrl, uploadedAt: paymentReceipts.uploadedAt }).from(paymentReceipts).where(eq(paymentReceipts.orderId, order.id)).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)),
      db.select({ status: orderEmails.status, attempts: orderEmails.attempts, messageId: orderEmails.gmailMessageId, threadId: orderEmails.gmailThreadId, rfcMessageId: orderEmails.rfcMessageId }).from(orderEmails).where(eq(orderEmails.orderId, order.id)),
      db.select({ id: orderNotifications.id }).from(orderNotifications).where(and(eq(orderNotifications.orderId, order.id), ne(orderNotifications.status, "ENVIADO"))).limit(1),
    ]);
    const latestByImprint = (imprint: "universidad" | "instituto") => receipts.find((receipt) => receipt.publisherImprint === imprint) ?? null;
    const hasNewReceipt = (imprint: "universidad" | "instituto") => {
      const latest = latestByImprint(imprint);
      const submittedId = imprint === "universidad" ? order.submittedReceiptUniversidad : order.submittedReceiptInstituto;
      const submitted = submittedId ? receipts.find((receipt) => receipt.id === submittedId) : null;
      return Boolean(latest && (!submitted || latest.id !== submitted.id));
    };
    return { order, items, receipts, emailStatus: mail[0]?.status ?? "PENDIENTE", emailThreadId: mail[0]?.threadId ?? null, emailMessageId: mail[0]?.messageId ?? null, emailRfcMessageId: mail[0]?.rfcMessageId ?? null,
      hasPendingNotifications: pendingNotifications.length > 0, hasNewUniversidadReceipt: hasNewReceipt("universidad"), hasNewInstitutoReceipt: hasNewReceipt("instituto"),
    };
  });
}
