import "server-only";
import { headers } from "next/headers";
import { and, asc, count, desc, eq, ilike, ne, or, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, orderItems, orders, paymentReceipts } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import type { z } from "zod";
import { filterSchema } from "./validation";

export async function listOrders(filters: z.infer<typeof filterSchema>) {
  const requestHeaders = await headers();
  return withDatabase(async (db) => {
    await getAuthorizedSession(db, requestHeaders);
    const term = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const condition = and(
      filters.q ? or(ilike(orders.orderNumber, term), ilike(orders.customerName, term), ilike(orders.customerEmail, term)) : undefined,
      filters.status ? eq(orders.orderStatus, filters.status) : undefined,
      filters.payment ? or(eq(orders.paymentStatusUniversidad, filters.payment), eq(orders.paymentStatusInstituto, filters.payment)) : undefined,
      filters.imprint === "universidad" ? ne(orders.orderType, "solo_instituto") : filters.imprint === "instituto" ? ne(orders.orderType, "solo_universidad") : undefined,
    );
    const [rows, totals] = await Promise.all([
      db.select({ id: orders.id, number: orders.orderNumber, name: orders.customerName, email: orders.customerEmail, total: orders.total, status: orders.orderStatus, universidad: orders.paymentStatusUniversidad, instituto: orders.paymentStatusInstituto, delivery: orders.deliveryType, createdAt: orders.createdAt }).from(orders).where(condition).orderBy(desc(orders.createdAt), desc(orders.id)).limit(20).offset((filters.page - 1) * 20),
      db.select({ total: count() }).from(orders).where(condition),
    ]);
    return { rows, total: totals[0].total };
  });
}

export async function orderDetail(id: string) {
  const requestHeaders = await headers();
  return withDatabase(async (db) => {
    await getAuthorizedSession(db, requestHeaders);
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return null;
    const [items, receipts] = await Promise.all([
      db.select({ id: orderItems.id, title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, imprint: orderItems.publisherImprint, price: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id)),
      db.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, id)).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)),
    ]);
    return { order, items, receipts };
  });
}

export async function inventoryRows() {
  const requestHeaders = await headers();
  return withDatabase(async (db) => {
    await getAuthorizedSession(db, requestHeaders);
    const rows = await db.select().from(books).orderBy(asc(books.title), asc(books.id));
    return rows.map((row) => ({ id: row.id, inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status, version: row.updatedAt.toISOString() }));
  });
}
