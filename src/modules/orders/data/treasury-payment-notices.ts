import { withDatabase, withReadDatabase, type Database } from "@/db";
import { books, orderItems, orders, paymentReceipts, paymentUploads, treasuryMailboxes, treasuryPaymentNotices } from "@/db/schema";
import type { Imprint } from "@/modules/orders/domain/types";
import { and, asc, eq, sql } from "drizzle-orm";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type NoticeStatus = typeof treasuryPaymentNotices.$inferSelect.status;

export async function createTreasuryPaymentNotice(tx: Transaction, orderId: string, imprint: Imprint, receiptId: string, buyerEmail: string) {
  const [mailbox] = await tx.select({ email: treasuryMailboxes.email }).from(treasuryMailboxes)
    .where(eq(treasuryMailboxes.publisherImprint, imprint));
  const recipient = mailbox?.email && mailbox.email !== buyerEmail ? mailbox.email : null;
  const [notice] = await tx.insert(treasuryPaymentNotices).values({
    orderId, publisherImprint: imprint, receiptId, recipient,
    status: recipient ? "NO_ENVIADO" : "OMITIDO",
  }).onConflictDoNothing().returning({ id: treasuryPaymentNotices.id });
  return notice?.id ?? null;
}

export async function listTreasuryPaymentNoticeStatuses(orderId: string) {
  return withReadDatabase((db) => db.select({
    publisherImprint: treasuryPaymentNotices.publisherImprint,
    recipient: treasuryPaymentNotices.recipient,
    status: treasuryPaymentNotices.status,
  }).from(treasuryPaymentNotices).where(eq(treasuryPaymentNotices.orderId, orderId)));
}

export async function readTreasuryPaymentNotice(id: string) {
  return withReadDatabase(async (db) => {
    const [record] = await db.select({
      notice: {
        orderId: treasuryPaymentNotices.orderId, imprint: treasuryPaymentNotices.publisherImprint,
        recipient: treasuryPaymentNotices.recipient, status: treasuryPaymentNotices.status,
      },
      order: {
        orderNumber: orders.orderNumber,
        customerName: orders.customerName, customerDocument: orders.customerDocument,
        billingRuc: orders.billingRuc, billingBusinessName: orders.billingBusinessName, billingAddress: orders.billingAddress,
        subtotalUniversidad: orders.subtotalUniversidad, subtotalInstituto: orders.subtotalInstituto,
        shippingUniversidad: orders.shippingUniversidad, shippingInstituto: orders.shippingInstituto,
        totalUniversidad: orders.totalUniversidad, totalInstituto: orders.totalInstituto,
      },
      receipt: {
        driveFileId: paymentReceipts.driveFileId, fileName: paymentReceipts.fileName, hash: paymentUploads.contentHash,
        mimeType: paymentUploads.mimeType, size: paymentUploads.size,
      },
    }).from(treasuryPaymentNotices)
      .innerJoin(orders, eq(orders.id, treasuryPaymentNotices.orderId))
      .innerJoin(paymentReceipts, and(
        eq(paymentReceipts.id, treasuryPaymentNotices.receiptId),
        eq(paymentReceipts.orderId, treasuryPaymentNotices.orderId),
        eq(paymentReceipts.publisherImprint, treasuryPaymentNotices.publisherImprint),
      ))
      .leftJoin(paymentUploads, eq(paymentUploads.id, paymentReceipts.uploadId))
      .where(eq(treasuryPaymentNotices.id, id));
    if (!record || record.notice.status !== "NO_ENVIADO") return null;
    const items = await db.select({
      title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`,
      quantity: orderItems.quantity, unitPrice: orderItems.unitPrice, subtotal: orderItems.subtotal,
    }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId))
      .where(and(eq(orderItems.orderId, record.notice.orderId), eq(orderItems.publisherImprint, record.notice.imprint)))
      .orderBy(asc(orderItems.id));
    return { ...record, items };
  });
}

export async function claimTreasuryPaymentNotice(id: string, orderId: string, imprint: Imprint, recipient: string) {
  return withDatabase((db) => db.transaction(async (tx) => {
    const [order] = await tx.select({
      status: orders.orderStatus, buyerEmail: orders.customerEmail,
      payment: imprint === "universidad" ? orders.paymentStatusUniversidad : orders.paymentStatusInstituto,
    }).from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || order.status === "CANCELADO" || order.payment !== "VERIFICADO") return false;
    const [mailbox] = await tx.select({ email: treasuryMailboxes.email }).from(treasuryMailboxes)
      .where(eq(treasuryMailboxes.publisherImprint, imprint));
    const ready = recipient === mailbox?.email && recipient !== order.buyerEmail;
    const [notice] = await tx.update(treasuryPaymentNotices).set({ status: ready ? "ENVIANDO" : "ERROR" })
      .where(and(
        eq(treasuryPaymentNotices.id, id), eq(treasuryPaymentNotices.orderId, orderId),
        eq(treasuryPaymentNotices.publisherImprint, imprint), eq(treasuryPaymentNotices.recipient, recipient),
        eq(treasuryPaymentNotices.status, "NO_ENVIADO"),
      ))
      .returning({ id: treasuryPaymentNotices.id });
    return ready && Boolean(notice);
  }));
}

export async function recordTreasuryPaymentNoticeResult(
  id: string, previous: NoticeStatus, status: NoticeStatus,
  gmail?: { id: string; threadId: string },
) {
  await withDatabase((db) => db.update(treasuryPaymentNotices)
    .set({ status, ...(gmail ? { gmailMessageId: gmail.id, gmailThreadId: gmail.threadId } : {}) })
    .where(and(eq(treasuryPaymentNotices.id, id), eq(treasuryPaymentNotices.status, previous))));
}
