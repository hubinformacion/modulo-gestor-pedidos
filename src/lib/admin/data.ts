import "server-only";
import { headers } from "next/headers";
import { and, asc, count, desc, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { books, campuses, pickupEvidence, orderActivity, orderItems, orders, paymentReceipts } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import type { z } from "zod";
import { resolveOrderLocation } from "@/lib/orders/location";
import { filterSchema } from "./validation";

export async function listOrders(filters: z.infer<typeof filterSchema>) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const term = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const condition = and(
      filters.owner === "mine" ? eq(orders.assignedTo, actor.userId) : filters.owner === "unassigned" ? and(isNull(orders.assignedTo), ne(orders.orderStatus, "ENTREGADO"), ne(orders.orderStatus, "CANCELADO")) : undefined,
      filters.q ? or(ilike(orders.orderNumber, term), ilike(orders.customerName, term), ilike(orders.customerEmail, term), ilike(orders.assignedName, term)) : undefined,
      filters.status ? eq(orders.orderStatus, filters.status) : undefined,

    );
    const [rows, totals] = await Promise.all([
      db.select({ id: orders.id, number: orders.orderNumber, name: orders.customerName, email: orders.customerEmail, total: orders.total, status: orders.orderStatus, universidad: orders.paymentStatusUniversidad, instituto: orders.paymentStatusInstituto, assignedTo: orders.assignedTo, assignedName: orders.assignedName, delivery: orders.deliveryType, createdAt: orders.createdAt }).from(orders).where(condition).orderBy(desc(orders.createdAt), desc(orders.id)).limit(20).offset((filters.page - 1) * 20),
      db.select({ total: count() }).from(orders).where(condition),
    ]);
    const visibleRows = rows.map((row) => {
      const attentionStatus: typeof row.status | "EN_REVISION" | "RECHAZADO" = row.status !== "PENDIENTE_PAGO" ? row.status : [row.universidad, row.instituto].includes("EN_REVISION") ? "EN_REVISION" : [row.universidad, row.instituto].includes("RECHAZADO") ? "RECHAZADO" : row.status;
      return { ...row, attentionStatus };
    });
    return { rows: visibleRows, total: totals[0].total, actorId: actor.userId };
  });
}

export async function orderDetail(id: string) {
  const requestHeaders = await headers();
  await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const [record] = await db.select({ order: orders, campus: campuses }).from(orders).leftJoin(campuses, eq(orders.deliveryCampus, campuses.id)).where(eq(orders.id, id));
    if (!record) return null;
    const order = resolveOrderLocation(record.order, record.campus);
    const [items, receipts, activity, notes, evidence] = await Promise.all([
      db.select({ id: orderItems.id, title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, imprint: orderItems.publisherImprint, price: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
      db.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, id)).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)),
      db.select().from(orderActivity).where(and(eq(orderActivity.orderId, id), ne(orderActivity.eventType, "NOTA_INTERNA"))).orderBy(desc(orderActivity.createdAt)).limit(50),
      db.select({ id: orderActivity.id, content: orderActivity.detail, author: orderActivity.actorName, createdAt: orderActivity.createdAt }).from(orderActivity).where(and(eq(orderActivity.orderId, id), eq(orderActivity.eventType, "NOTA_INTERNA"))).orderBy(desc(orderActivity.createdAt), desc(orderActivity.id)).limit(50),
      db.select().from(pickupEvidence).where(and(eq(pickupEvidence.orderId, id), sql`${pickupEvidence.confirmedAt} IS NOT NULL`)).orderBy(desc(pickupEvidence.confirmedAt)),
    ]);
    return { order, items, receipts, activity, notes, evidence };
  });
}

export async function inventoryRows() {
  const requestHeaders = await headers();
  await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const rows = await db.select().from(books).orderBy(asc(books.title), asc(books.id));
    return rows.map((row) => ({ id: row.id, inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status, version: row.updatedAt.toISOString() }));
  });
}
