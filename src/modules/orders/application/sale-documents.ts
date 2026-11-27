import { withDatabase, withReadDatabase } from "@/db";
import { orderActivity, orderEmails, orderNotifications, orderSaleIssuances, saleDocumentBatches, saleDocuments } from "@/db/schema";
import { readSmallDriveFile, reserveDriveFileId, uploadFileToDrive } from "@/integrations/google/drive";
import { assertOrderOperator } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { lockSaleIssuance } from "@/modules/orders/data/sale-documents";
import { OperationError, checkVersion } from "@/modules/orders/domain/operation-error";
import { receiptMimeType } from "@/modules/orders/domain/receipt";
import { StaleDocumentBatch, maxSaleFileBytes, saleFileSchema, saleMimeTypes, type SaleFormat } from "@/modules/orders/domain/sale-documents";
import { isWellFormedXml } from "@/shared/utils/xml";
import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { createHash } from "node:crypto";
import "server-only";

type Issuance = typeof orderSaleIssuances.$inferSelect;

function checkDraftCycle(issuance: Issuance, cycle: number) {
  if (issuance.cycle !== cycle || issuance.status === "FINALIZADA") {
    throw new OperationError("Los documentos cambiaron. Actualiza el pedido.");
  }
}

function validSaleBytes(bytes: Buffer, mimeType: typeof saleDocuments.$inferSelect.mimeType) {
  return mimeType === saleMimeTypes.pdf ? receiptMimeType(bytes) === mimeType : isWellFormedXml(bytes);
}

export async function uploadSaleDocument(actor: AuthorizedActor, id: string, uploadId: string, cycle: number, format: SaleFormat, file: File) {
  const parsed = saleFileSchema.safeParse(file);
  if (!parsed.success) throw new OperationError(parsed.error.issues[0].message);
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name;
  const mimeType = saleMimeTypes[format];
  if (!filename.toLowerCase().endsWith(`.${format}`) || !validSaleBytes(bytes, mimeType)) throw new OperationError(`Adjunta un ${format.toUpperCase()} válido.`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const draftField = format === "pdf" ? "draftDocumentId" : "draftXmlDocumentId";

  const previous = await withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, issuance } = await lockSaleIssuance(tx, actor, id);
    checkDraftCycle(issuance, cycle);
    const [document] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    return { document, assignedTo: order.assignedTo, assignedAt: order.assignedAt?.getTime() };
  }));
  const driveFileId = previous.document?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, issuance } = await lockSaleIssuance(tx, actor, id);
    checkDraftCycle(issuance, cycle);
    if (order.assignedTo !== previous.assignedTo || order.assignedAt?.getTime() !== previous.assignedAt) throw new OperationError("La atención cambió durante la carga. Actualiza el pedido.");
    if (issuance[draftField] && issuance[draftField] !== uploadId) throw new OperationError("Retira primero el borrador existente.");
    const [stored] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    if (stored) {
      if (stored.issuanceId !== id || stored.cycle !== cycle || stored.actorEmail !== actor.email || stored.contentHash !== hash || stored.fileName !== filename || stored.mimeType !== mimeType) throw new OperationError("El intento no corresponde a este archivo. Selecciónalo de nuevo.");
      return stored;
    }
    const [usage] = await tx.select({ total: count() }).from(saleDocuments).where(and(eq(saleDocuments.issuanceId, id), eq(saleDocuments.cycle, cycle), eq(saleDocuments.mimeType, mimeType)));
    if (usage.total >= 10) throw new OperationError("Se alcanzó el límite de archivos de esta revisión.");
    const [document] = await tx.insert(saleDocuments).values({ id: uploadId, issuanceId: id, cycle, actorEmail: actor.email, driveFileId, contentHash: hash, fileName: filename, size: file.size, mimeType }).returning();
    return document;
  }));

  const uploaded = intent.driveViewUrl ? { driveViewUrl: intent.driveViewUrl } : await uploadFileToDrive({ id: intent.driveFileId, name: filename, mimeType, bytes });
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, issuance } = await lockSaleIssuance(tx, actor, id);
    checkDraftCycle(issuance, cycle);
    if (order.assignedTo !== previous.assignedTo || order.assignedAt?.getTime() !== previous.assignedAt) throw new OperationError("La atención cambió durante la carga. Actualiza el pedido.");
    if (issuance[draftField] && issuance[draftField] !== uploadId) throw new OperationError("El borrador cambió. Actualiza el pedido.");
    const [stored] = await tx.select({ uploadedAt: saleDocuments.uploadedAt }).from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    if (stored.uploadedAt) {
      if (issuance[draftField] !== uploadId) throw new OperationError("El borrador fue retirado. Selecciona el archivo de nuevo.");
      return { documentId: uploadId, fileName: filename, driveViewUrl: uploaded.driveViewUrl, version: issuance.updatedAt.toISOString() };
    }
    await tx.update(saleDocuments).set({ driveViewUrl: uploaded.driveViewUrl, uploadedAt: new Date() }).where(eq(saleDocuments.id, uploadId));
    const [updated] = await tx.update(orderSaleIssuances).set({ [draftField]: uploadId }).where(eq(orderSaleIssuances.id, id)).returning({ updatedAt: orderSaleIssuances.updatedAt });
    return { documentId: uploadId, fileName: filename, driveViewUrl: uploaded.driveViewUrl, version: updated.updatedAt.toISOString() };
  }));
}

export async function removeSaleDraft(actor: AuthorizedActor, input: { id: string; documentId: string; cycle: number; format: SaleFormat }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { issuance } = await lockSaleIssuance(tx, actor, input.id);
    checkDraftCycle(issuance, input.cycle);
    const draftField = input.format === "pdf" ? "draftDocumentId" : "draftXmlDocumentId";
    if (!issuance[draftField]) return issuance.updatedAt.toISOString();
    if (issuance[draftField] !== input.documentId) throw new OperationError("El borrador cambió. Actualiza el pedido.");
    const [updated] = await tx.update(orderSaleIssuances).set({ [draftField]: null }).where(eq(orderSaleIssuances.id, issuance.id)).returning({ updatedAt: orderSaleIssuances.updatedAt });
    return updated.updatedAt.toISOString();
  }));
}

export async function finalizeSaleDocument(actor: AuthorizedActor, input: { id: string; version: string; documentId: string; xmlDocumentId: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, issuance } = await lockSaleIssuance(tx, actor, input.id);
    const result = { orderId: order.id, token: order.trackingToken, notificationId: null as string | null };
    if (issuance.status === "FINALIZADA" && issuance.finalizedDocumentId === input.documentId && issuance.finalizedXmlDocumentId === input.xmlDocumentId) return result;
    checkDraftCycle(issuance, issuance.cycle);
    checkVersion(issuance.updatedAt, input.version);
    if (issuance.draftDocumentId !== input.documentId || issuance.draftXmlDocumentId !== input.xmlDocumentId) throw new OperationError("Los borradores cambiaron. Actualiza el pedido.");
    const files = await tx.select().from(saleDocuments).where(and(
      inArray(saleDocuments.id, [input.documentId, input.xmlDocumentId]),
      eq(saleDocuments.issuanceId, issuance.id),
      eq(saleDocuments.cycle, issuance.cycle),
    ));
    const pdf = files.find((file) => file.id === input.documentId && file.mimeType === saleMimeTypes.pdf);
    const xml = files.find((file) => file.id === input.xmlDocumentId && file.mimeType === saleMimeTypes.xml);
    if (!pdf?.uploadedAt || !xml?.uploadedAt || !pdf.driveViewUrl || !xml.driveViewUrl) throw new OperationError("Adjunta el PDF y el XML antes de confirmar.");

    await tx.update(orderSaleIssuances).set({
      status: "FINALIZADA", finalizedDocumentId: pdf.id, finalizedXmlDocumentId: xml.id, finalizedBy: actor.email, finalizedAt: new Date(),
      draftDocumentId: null, draftXmlDocumentId: null,
    }).where(eq(orderSaleIssuances.id, issuance.id));
    const imprintLabel = issuance.publisherImprint === "universidad" ? "Universidad" : "Instituto";
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "DOCUMENTOS_CONFIRMADOS", detail: `Confirmó los documentos de venta de ${imprintLabel}.` });

    const issuances = await tx.select().from(orderSaleIssuances).where(eq(orderSaleIssuances.orderId, order.id)).orderBy(asc(orderSaleIssuances.publisherImprint));
    const required = issuances.filter((row) => order.orderType === "mixto" || (row.publisherImprint === "universidad" ? order.orderType === "solo_universidad" : order.orderType === "solo_instituto"));
    // A historical finalized PDF may lack XML. New confirmations always require both files.
    if (required.length !== (order.orderType === "mixto" ? 2 : 1) || !required.every((row) => row.status === "FINALIZADA" && row.finalizedDocumentId)) return result;

    const documentIds = required.flatMap(issuedSaleIds);
    const batchKey = `${order.id}:${documentIds.join(":")}`;
    const [batch] = await tx.insert(saleDocumentBatches).values({ orderId: order.id, batchKey, documentIds, correction: required.some((row) => row.cycle > 1) }).onConflictDoNothing().returning();
    if (!batch) return result;
    const [event] = await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "DOCUMENTOS_VENTA", payload: { batchId: batch.id, correction: String(batch.correction) } }).returning({ id: orderNotifications.id });
    return { ...result, notificationId: event.id };
  }));
}

export async function reviseSaleDocuments(actor: AuthorizedActor, input: { id: string; version: string; reason: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, issuance } = await lockSaleIssuance(tx, actor, input.id);
    checkVersion(issuance.updatedAt, input.version);
    if (issuance.status !== "FINALIZADA") throw new OperationError("Confirma los documentos antes de abrir una corrección.");
    const [sending] = await tx.select({ id: orderNotifications.id }).from(orderNotifications)
      .innerJoin(orderEmails, eq(orderEmails.orderId, orderNotifications.orderId))
      .where(and(eq(orderNotifications.orderId, order.id), eq(orderNotifications.eventType, "DOCUMENTOS_VENTA"), eq(orderNotifications.status, "ENVIANDO"), gt(orderEmails.leaseUntil, new Date()))).limit(1);
    if (sending) throw new OperationError("Los documentos se están enviando al comprador. Espera un momento antes de corregirlos.");
    await tx.update(orderSaleIssuances).set({ status: "DEVUELTA", cycle: issuance.cycle + 1, draftDocumentId: null, draftXmlDocumentId: null, returnReason: input.reason }).where(eq(orderSaleIssuances.id, issuance.id));
    const imprintLabel = issuance.publisherImprint === "universidad" ? "Universidad" : "Instituto";
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "DOCUMENTOS_EN_CORRECCION", detail: `Abrió una corrección de documentos de ${imprintLabel}: ${input.reason}` });
    return { orderId: order.id };
  }));
}

function issuedSaleIds(issuance: Pick<Issuance, "finalizedDocumentId" | "finalizedXmlDocumentId">) {
  return [issuance.finalizedDocumentId, issuance.finalizedXmlDocumentId].filter((id): id is string => id !== null);
}

export async function readSaleBatch(orderId: string, batchId: string) {
  return withReadDatabase(async (db) => {
    const [batch] = await db.select().from(saleDocumentBatches).where(and(eq(saleDocumentBatches.id, batchId), eq(saleDocumentBatches.orderId, orderId)));
    if (!batch) throw new StaleDocumentBatch();
    const issuances = await db.select().from(orderSaleIssuances).where(eq(orderSaleIssuances.orderId, orderId));
    const issuedIds = issuances.flatMap(issuedSaleIds);
    if (!issuances.every((row) => row.status === "FINALIZADA" && row.finalizedDocumentId) ||
      issuedIds.length !== batch.documentIds.length || !issuedIds.every((id) => batch.documentIds.includes(id))) throw new StaleDocumentBatch();
    const documents = await db.select({ document: saleDocuments, imprint: orderSaleIssuances.publisherImprint }).from(saleDocuments)
      .innerJoin(orderSaleIssuances, eq(orderSaleIssuances.id, saleDocuments.issuanceId))
      .where(and(eq(orderSaleIssuances.orderId, orderId), inArray(saleDocuments.id, batch.documentIds)))
      .orderBy(asc(orderSaleIssuances.publisherImprint), asc(saleDocuments.mimeType));
    if (documents.length !== batch.documentIds.length || documents.some((row) => !row.document.uploadedAt)) throw new StaleDocumentBatch();
    return documents;
  });
}

export async function saleDocumentBytes(fileId: string, expectedHash: string, mimeType: typeof saleDocuments.$inferSelect.mimeType) {
  const bytes = await readSmallDriveFile(fileId, maxSaleFileBytes);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash || !validSaleBytes(bytes, mimeType)) throw new OperationError("El documento almacenado no coincide con el archivo confirmado.");
  return bytes;
}
