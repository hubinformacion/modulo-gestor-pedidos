import { withReadDatabase, type Database } from "@/db";
import { authorizedEmails, orders, orderSaleIssuances, saleDocumentBatches, saleDocuments, user } from "@/db/schema";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { MASTER_EMAIL } from "@/modules/access/domain/policy";
import { OperationError } from "@/modules/orders/domain/operation-error";
import { canManageSaleDocuments } from "@/modules/orders/domain/sale-documents";
import { and, asc, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Issuance = typeof orderSaleIssuances.$inferSelect;

const activeAssignee = sql<boolean>`EXISTS (
  SELECT 1 FROM ${user} JOIN ${authorizedEmails} ON ${authorizedEmails.email} = ${user.email}
  WHERE ${user.id} = ${orders.assignedTo} AND ${user.emailVerified}
    AND ${authorizedEmails.role} = 'gestor' AND ${user.email} <> ${MASTER_EMAIL}
)`;

const issuedFile = and(
  eq(saleDocuments.issuanceId, orderSaleIssuances.id),
  isNotNull(saleDocuments.uploadedAt),
  or(eq(saleDocuments.id, orderSaleIssuances.finalizedDocumentId), eq(saleDocuments.id, orderSaleIssuances.finalizedXmlDocumentId)),
);

export async function createSaleIssuance(tx: Transaction, orderId: string, imprint: Issuance["publisherImprint"]) {
  await tx.insert(orderSaleIssuances).values({ orderId, publisherImprint: imprint }).onConflictDoNothing();
}

export async function lockSaleIssuance(tx: Transaction, actor: AuthorizedActor, id: string) {
  const [reference] = await tx.select({ orderId: orderSaleIssuances.orderId }).from(orderSaleIssuances).where(eq(orderSaleIssuances.id, id));
  if (!reference) throw new OperationError("No se encontró la emisión.");
  // Serialize seals of a mixed order so the final confirmation creates one batch.
  const [record] = await tx.select({ order: orders, assigneeActive: activeAssignee }).from(orders).where(eq(orders.id, reference.orderId)).for("update");
  if (!record || !canManageSaleDocuments(actor, record.order, record.assigneeActive)) throw new OperationError("El gestor responsable del pedido registra sus documentos de venta.");
  const [issuance] = await tx.select().from(orderSaleIssuances).where(eq(orderSaleIssuances.id, id)).for("update");
  if (!issuance) throw new OperationError("No se encontró la emisión.");
  const payment = issuance.publisherImprint === "universidad" ? record.order.paymentStatusUniversidad : record.order.paymentStatusInstituto;
  if (payment !== "VERIFICADO" || issuance.status === "ANULADA") throw new OperationError("La emisión requiere un pago verificado y un pedido vigente.");
  return { order: record.order, issuance };
}

export async function adminSaleDocuments(orderId: string, actor: AuthorizedActor) {
  return withReadDatabase(async (db) => {
    const [[record], issuances, documents, batches] = await Promise.all([
      db.select({ assignedTo: orders.assignedTo, orderStatus: orders.orderStatus, assigneeActive: activeAssignee }).from(orders).where(eq(orders.id, orderId)),
      db.select().from(orderSaleIssuances).where(eq(orderSaleIssuances.orderId, orderId)).orderBy(asc(orderSaleIssuances.publisherImprint)),
      db.select({ document: saleDocuments }).from(saleDocuments).innerJoin(orderSaleIssuances, eq(saleDocuments.issuanceId, orderSaleIssuances.id))
        .where(and(eq(orderSaleIssuances.orderId, orderId), isNotNull(saleDocuments.uploadedAt))).orderBy(desc(saleDocuments.createdAt)),
      db.select({ ids: saleDocumentBatches.documentIds }).from(saleDocumentBatches).where(eq(saleDocumentBatches.orderId, orderId)),
    ]);
    return {
      canEdit: Boolean(record && canManageSaleDocuments(actor, record, record.assigneeActive)),
      issuances,
      documents: documents.map(({ document }) => document),
      confirmedIds: batches.flatMap(({ ids }) => ids),
    };
  });
}

export async function customerSaleDocuments(orderId: string) {
  return withReadDatabase((db) => db.select({
    id: saleDocuments.id,
    name: saleDocuments.fileName,
    mimeType: saleDocuments.mimeType,
    imprint: orderSaleIssuances.publisherImprint,
    finalizedAt: orderSaleIssuances.finalizedAt,
  }).from(orderSaleIssuances).innerJoin(saleDocuments, issuedFile).where(eq(orderSaleIssuances.orderId, orderId))
    .orderBy(asc(orderSaleIssuances.publisherImprint), asc(saleDocuments.mimeType)));
}

export async function customerSaleDocumentFile(token: string, documentId: string) {
  const [file] = await withReadDatabase((db) => db.select({
    driveId: saleDocuments.driveFileId,
    hash: saleDocuments.contentHash,
    fileName: saleDocuments.fileName,
    mimeType: saleDocuments.mimeType,
  }).from(orders).innerJoin(orderSaleIssuances, eq(orderSaleIssuances.orderId, orders.id)).innerJoin(saleDocuments, issuedFile)
    .where(and(eq(orders.trackingToken, token), eq(saleDocuments.id, documentId))));
  return file;
}
