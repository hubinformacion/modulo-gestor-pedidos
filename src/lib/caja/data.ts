import "server-only";
import { headers } from "next/headers";
import { previousSaleDocuments } from "./document-history";
import { ensureCajaFileReader } from "./drive-access";
import { reportServerError } from "@/lib/server-diagnostics";
import { and, asc, count, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { withDatabase, withReadDatabase } from "@/db";
import { books, cajaRequests, orderItems, orders, paymentReceipts, saleDocumentBatches, saleDocuments, treasuryNotes, treasuryActivity, treasuryObservations, treasurySupportingFiles } from "@/db/schema";
import { getCajaSession } from "@/lib/access";
import type { z } from "zod";
import type { cajaFiltersSchema } from "./validation";
export async function cajaInbox(filters: z.infer<typeof cajaFiltersSchema>) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
  return withReadDatabase(async (db) => {
    const term = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
    const where = and(inArray(cajaRequests.publisherImprint, filters.imprint ? actor.publisherImprints.filter((imprint) => imprint === filters.imprint) : actor.publisherImprints), filters.owner === "mine" ? eq(cajaRequests.assignedTo, actor.userId) : filters.owner === "unassigned" ? and(isNull(cajaRequests.assignedTo), ne(cajaRequests.status, "FINALIZADA"), ne(cajaRequests.status, "ANULADA")) : undefined, filters.state === "observed" ? sql`EXISTS (SELECT 1 FROM ${treasuryObservations} o WHERE o.request_id = ${cajaRequests.id} AND o.resolved_at IS NULL) AND ${cajaRequests.status} NOT IN ('FINALIZADA','ANULADA')` : filters.state === "pending" ? and(ne(cajaRequests.status, "FINALIZADA"), ne(cajaRequests.status, "ANULADA")) : filters.state === "finished" ? eq(cajaRequests.status, "FINALIZADA") : filters.state === "cancelled" ? eq(cajaRequests.status, "ANULADA") : undefined, filters.q ? or(ilike(orders.orderNumber, term), ilike(orders.customerName, term), ilike(orders.billingBusinessName, term)) : undefined);
    const [rows, totals] = await Promise.all([
      db.select({ id: cajaRequests.id, number: orders.orderNumber, customer: orders.customerName, businessName: orders.billingBusinessName, invoice: sql<boolean>`${orders.billingRuc} IS NOT NULL`, amount: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.totalUniversidad} ELSE ${orders.totalInstituto} END`, status: cajaRequests.status, observed: sql<boolean>`EXISTS (SELECT 1 FROM ${treasuryObservations} o WHERE o.request_id = ${cajaRequests.id} AND o.resolved_at IS NULL) AND ${cajaRequests.status} NOT IN ('FINALIZADA','ANULADA')`, assignedName: cajaRequests.assignedName, draftId: cajaRequests.draftDocumentId, createdAt: cajaRequests.createdAt, imprint: cajaRequests.publisherImprint }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(where).orderBy((filters.dir === "asc" ? asc : desc)({ number: sql`ROW(split_part(${orders.orderNumber}, '-', 2)::int, split_part(${orders.orderNumber}, '-', 1)::int)`, customer: sql`coalesce(${orders.billingBusinessName}, ${orders.customerName})`, document: sql`CASE WHEN ${orders.billingRuc} IS NULL THEN 0 ELSE 1 END`, amount: sql`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.totalUniversidad} ELSE ${orders.totalInstituto} END`, status: sql`CASE WHEN ${cajaRequests.status} NOT IN ('FINALIZADA','ANULADA') AND EXISTS (SELECT 1 FROM ${treasuryObservations} o WHERE o.request_id = ${cajaRequests.id} AND o.resolved_at IS NULL) THEN 'OBSERVADA' ELSE ${cajaRequests.status} END`, assigned: cajaRequests.assignedName, date: cajaRequests.createdAt, imprint: cajaRequests.publisherImprint }[filters.sort]), desc(cajaRequests.id)).limit(20).offset((filters.page - 1) * 20),
      db.select({ total: count() }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(where),
    ]);
    return { rows, total: totals[0].total, imprints: actor.publisherImprints, service: actor.treasuryService };
  });
}
export async function cajaDetail(id: string) {
  const requestHeaders = await headers();
  const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
  const detail = await withReadDatabase(async (db) => {
    const [record] = await db.select({ request: cajaRequests, order: {
      number: orders.orderNumber, name: orders.customerName, email: orders.customerEmail, phone: orders.customerPhone, document: orders.customerDocument,
      billingRuc: orders.billingRuc, billingBusinessName: orders.billingBusinessName, billingAddress: orders.billingAddress,
      subtotal: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.subtotalUniversidad} ELSE ${orders.subtotalInstituto} END`,
      shipping: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.shippingUniversidad} ELSE ${orders.shippingInstituto} END`,
      total: sql<string>`CASE WHEN ${cajaRequests.publisherImprint} = 'universidad' THEN ${orders.totalUniversidad} ELSE ${orders.totalInstituto} END`,
    } }).from(cajaRequests).innerJoin(orders, eq(orders.id, cajaRequests.orderId)).where(and(eq(cajaRequests.id, id), inArray(cajaRequests.publisherImprint, actor.publisherImprints)));
    if (!record) return null;
    const [items, receipts, documents, batches, notes, activity, observations, supporting] = await Promise.all([
      db.select({ id: orderItems.id, title: sql<string>`coalesce(${orderItems.bookTitle}, ${books.title})`, code: sql<string>`coalesce(${orderItems.bookCode}, ${books.inventoryCode})`, basePrice: orderItems.baseUnitPrice, discountPercent: orderItems.discountPercent, price: orderItems.unitPrice, quantity: orderItems.quantity, subtotal: orderItems.subtotal }).from(orderItems).innerJoin(books, eq(books.id, orderItems.bookId)).where(and(eq(orderItems.orderId, record.request.orderId), eq(orderItems.publisherImprint, record.request.publisherImprint))).orderBy(asc(orderItems.id)),
      db.select({ id: paymentReceipts.id, fileName: paymentReceipts.fileName, driveFileId: paymentReceipts.driveFileId, driveViewUrl: paymentReceipts.driveViewUrl, uploadedAt: paymentReceipts.uploadedAt }).from(paymentReceipts).where(and(eq(paymentReceipts.orderId, record.request.orderId), eq(paymentReceipts.publisherImprint, record.request.publisherImprint))).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)),
      db.select({ id: saleDocuments.id, fileName: saleDocuments.fileName, contentHash: saleDocuments.contentHash, size: saleDocuments.size, driveFileId: saleDocuments.driveFileId, driveViewUrl: saleDocuments.driveViewUrl, cycle: saleDocuments.cycle, uploadedAt: saleDocuments.uploadedAt, actorEmail: saleDocuments.actorEmail }).from(saleDocuments).where(and(eq(saleDocuments.requestId, id), sql`${saleDocuments.uploadedAt} IS NOT NULL`)).orderBy(desc(saleDocuments.createdAt)),
      db.select({ ids: saleDocumentBatches.documentIds }).from(saleDocumentBatches).where(eq(saleDocumentBatches.orderId, record.request.orderId)),
      db.select().from(treasuryNotes).where(eq(treasuryNotes.requestId, id)).orderBy(desc(treasuryNotes.createdAt), desc(treasuryNotes.id)).limit(100),
      db.select().from(treasuryActivity).where(eq(treasuryActivity.requestId, id)).orderBy(desc(treasuryActivity.createdAt), desc(treasuryActivity.id)).limit(100),
      db.select().from(treasuryObservations).where(eq(treasuryObservations.requestId, id)).orderBy(asc(treasuryObservations.createdAt), asc(treasuryObservations.id)),
      db.select().from(treasurySupportingFiles).where(and(eq(treasurySupportingFiles.requestId, id), sql`${treasurySupportingFiles.uploadedAt} IS NOT NULL`)).orderBy(desc(treasurySupportingFiles.uploadedAt)),
    ]);
    // Internal Gmail IDs are not sent to client controls.
    const correction = observations.filter((o) => o.resolvedAt && o.correction).sort((a, b) => a.resolvedAt!.getTime() - b.resolvedAt!.getTime()).reduce((data, o) => ({ ...data, ...o.correction }), {} as Record<string, string>);
    return { request: record.request, order: { ...record.order, ...correction }, items, receipts, documents, notes, activity, observations, supporting, confirmedIds: batches.flatMap((batch) => batch.ids) };
  });
  if (!detail) return null;
  const activeId = ["FINALIZADA", "ANULADA"].includes(detail.request.status) ? detail.request.finalizedDocumentId : detail.request.draftDocumentId;
  const historyIds = new Set(previousSaleDocuments(detail.documents, detail.request.cycle, activeId, detail.confirmedIds, detail.request.finalizedDocumentId).map((file) => file.id));
  const prepare = async <T extends { driveFileId: string; driveViewUrl: string | null }>(file: T) => {
    try { await ensureCajaFileReader(actor, id, file.driveFileId); return { ...file, driveReady: true }; }
    catch (error) { reportServerError("caja.drive.access.pending", error); return { ...file, driveReady: false }; }
  };
  const [receipts, documents] = await Promise.all([Promise.all(detail.receipts.map(prepare)), Promise.all(detail.documents.map((file) => (file.id === detail.request.draftDocumentId || file.id === detail.request.finalizedDocumentId || historyIds.has(file.id)) ? prepare(file) : Promise.resolve({ ...file, driveReady: false })))]);
  return { ...detail, actorId: actor.userId, service: actor.treasuryService, receipts, documents, history: documents.filter((file) => historyIds.has(file.id)) };
}
