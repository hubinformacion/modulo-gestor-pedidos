import "server-only";
import { headers } from "next/headers";
import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { books, cajaRequests, orderItems, orders, paymentReceipts, saleDocuments } from "@/db/schema";
import { getCajaSession } from "@/lib/access";
import type { z } from "zod";
import type { cajaFiltersSchema } from "./validation";
export async function cajaInbox(filters: z.infer<typeof cajaFiltersSchema>) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const term = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = and(eq(cajaRequests.publisherImprint, actor.publisherImprint!), filters.state === "pending" ? ne(cajaRequests.status, "FINALIZADA") : filters.state === "finished" ? eq(cajaRequests.status, "FINALIZADA") : undefined, filters.q ? or(ilike(orders.orderNumber, term), ilike(orders.customerName, term), ilike(orders.billingBusinessName, term)) : undefined);
    const [rows, totals] = await Promise.all([
      db.select({ id: cajaRequests.id, number: orders.orderNumber, customer: orders.customerName, businessName: orders.billingBusinessName, invoice: sql<boolean>`${orders.billingRuc} IS NOT NULL`, amount: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.totalUniversidad} ELSE ${orders.totalInstituto} END`, status: cajaRequests.status, draftId: cajaRequests.draftDocumentId, createdAt: cajaRequests.createdAt }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(where).orderBy(desc(cajaRequests.createdAt), desc(cajaRequests.id)).limit(20).offset((filters.page - 1) * 20),
      db.select({ total: count() }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(where),
    ]);
    return { rows, total: totals[0].total };
  });
}
export async function cajaDetail(id: string) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const [record] = await db.select({ request: cajaRequests, order: {
      number: orders.orderNumber, name: orders.customerName, email: orders.customerEmail, document: orders.customerDocument,
      billingRuc: orders.billingRuc, billingBusinessName: orders.billingBusinessName,
      subtotal: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.subtotalUniversidad} ELSE ${orders.subtotalInstituto} END`,
      shipping: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.shippingUniversidad} ELSE ${orders.shippingInstituto} END`,
      total: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.totalUniversidad} ELSE ${orders.totalInstituto} END`,
    } }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(and(eq(cajaRequests.id, id), eq(cajaRequests.publisherImprint, actor.publisherImprint!)));
    if (!record) return null;
    const [items, receipts, documents] = await Promise.all([
      db.select({ id: orderItems.id, title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, price: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(and(eq(orderItems.orderId, record.request.orderId), eq(orderItems.publisherImprint, actor.publisherImprint!))).orderBy(asc(orderItems.id)),
      db.select({ id: paymentReceipts.id, fileName: paymentReceipts.fileName, uploadedAt: paymentReceipts.uploadedAt }).from(paymentReceipts).where(and(eq(paymentReceipts.orderId, record.request.orderId), eq(paymentReceipts.publisherImprint, actor.publisherImprint!))).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)),
      db.select({ id: saleDocuments.id, fileName: saleDocuments.fileName, cycle: saleDocuments.cycle, uploadedAt: saleDocuments.uploadedAt, actorEmail: saleDocuments.actorEmail }).from(saleDocuments).where(and(eq(saleDocuments.requestId, id), sql`${saleDocuments.uploadedAt} IS NOT NULL`)).orderBy(desc(saleDocuments.createdAt)),
    ]);
    // Internal Gmail IDs are not sent to client controls.
    return { request: record.request, order: record.order, items, receipts, documents };
  });
}
