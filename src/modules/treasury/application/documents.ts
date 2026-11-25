import { withDatabase, withReadDatabase } from "@/db";
import { cajaNotifications, cajaRequests, orderActivity, orderEmails, orderNotifications, saleDocumentBatches, saleDocuments, treasuryActivity, treasuryObservations } from "@/db/schema";
import { readSmallDriveFile, reserveDriveFileId, uploadFileToDrive } from "@/integrations/google/drive";
import { assertOrderOperator, assertTreasuryOperator } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { receiptMimeType } from "@/modules/orders/domain/receipt";
import { lockRequest } from "@/modules/treasury/data/requests";
import { maxSaleFileBytes, saleFileSchema, saleMimeTypes, type SaleFormat } from "@/modules/treasury/domain/documents";
import { isWellFormedXml } from "@/shared/utils/xml";
import { CajaError, StaleDocumentBatch } from "@/modules/treasury/domain/errors";
import { and, asc, count, eq, gt, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import "server-only";




function checkCaja(request: typeof cajaRequests.$inferSelect, actor: AuthorizedActor, cycle: number) {
  if (!actor.publisherImprints.includes(request.publisherImprint)) throw new CajaError("No tienes acceso a esta solicitud.");
  if (request.assignedTo !== actor.userId) throw new CajaError("Toma la atención de la solicitud para modificar sus archivos.");
  if (request.cycle !== cycle || ["FINALIZADA", "ANULADA"].includes(request.status)) throw new CajaError("La solicitud cambió o ya fue finalizada. Actualiza la página.");
}
function checkVersion(actual: Date, expected: string) {
  if (actual.toISOString() !== expected) throw new CajaError("La solicitud cambió. Actualiza los datos antes de continuar.");
}
export async function uploadSaleDocument(actor: AuthorizedActor, id: string, uploadId: string, cycle: number, format: SaleFormat, file: File) {
  const parsed = saleFileSchema.safeParse(file);
  if (!parsed.success) throw new CajaError(parsed.error.issues[0].message);
  const bytes = Buffer.from(await file.arrayBuffer());
  const filename = file.name;
  const mimeType = saleMimeTypes[format];
  const valid = format === "pdf" ? receiptMimeType(bytes) === mimeType : isWellFormedXml(bytes);
  if (!filename.toLowerCase().endsWith(`.${format}`) || !valid) throw new CajaError(`Adjunta un ${format.toUpperCase()} válido.`);
  const hash = createHash("sha256").update(bytes).digest("hex");
  const draftKey = format === "pdf" ? "draftDocumentId" : "draftXmlDocumentId";
  const previous = await withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    const [document] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    return { document, token: request.assignmentToken };
  }));
  const driveFileId = previous.document?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    if (request.assignmentToken !== previous.token) throw new CajaError("La atención cambió durante la carga. Actualiza la solicitud.");
    const [stored] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    if (stored) {
      if (stored.requestId !== id || stored.cycle !== cycle || stored.actorEmail !== actor.email || stored.contentHash !== hash || stored.fileName !== filename || stored.mimeType !== mimeType) throw new CajaError("El intento no corresponde a este archivo. Selecciónalo de nuevo.");
      return stored;
    }
    const [usage] = await tx.select({ total: count() }).from(saleDocuments).where(and(eq(saleDocuments.requestId, id), eq(saleDocuments.cycle, cycle), eq(saleDocuments.mimeType, mimeType)));
    if (usage.total >= 10) throw new CajaError("Se alcanzó el límite de archivos de esta revisión. Contacta al gestor.");
    const [document] = await tx.insert(saleDocuments).values({ id: uploadId, requestId: id, cycle, actorEmail: actor.email, driveFileId, contentHash: hash, fileName: filename, size: file.size, mimeType }).returning();
    return document;
  }));
  const uploaded = intent.driveViewUrl ? { driveViewUrl: intent.driveViewUrl } : await uploadFileToDrive({ id: intent.driveFileId, name: filename, mimeType, bytes });
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    if (request.assignmentToken !== previous.token) throw new CajaError("La atención cambió durante la carga. Actualiza la solicitud.");
    const [stored] = await tx.select({ uploadedAt: saleDocuments.uploadedAt }).from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    if (stored.uploadedAt) {
      if (request[draftKey] !== uploadId) throw new CajaError("El borrador cambió. Actualiza la solicitud.");
      return { documentId: uploadId, fileName: filename, version: request.updatedAt.toISOString(), driveFileId: intent.driveFileId };
    }
    await tx.update(saleDocuments).set({ driveViewUrl: uploaded.driveViewUrl, uploadedAt: new Date() }).where(eq(saleDocuments.id, uploadId));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: format === "pdf" ? "PDF_CARGADO" : "XML_CARGADO", detail: `Adjuntó ${filename} como borrador.` });
    const [updated] = await tx.update(cajaRequests).set({ [draftKey]: uploadId }).where(eq(cajaRequests.id, id)).returning();
    return { documentId: uploadId, fileName: filename, version: updated.updatedAt.toISOString(), driveFileId: intent.driveFileId };
  }));
}
export async function finalizeSaleDocument(actor: AuthorizedActor, input: { id: string; version: string; documentId: string; xmlDocumentId: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado. No admite emisión de documentos.");
    if (!actor.publisherImprints.includes(request.publisherImprint)) throw new CajaError("No tienes acceso a esta solicitud.");
    if (request.assignedTo !== actor.userId) throw new CajaError("Solo el responsable de Tesorería Recaudación puede finalizar esta solicitud.");
    if (request.status === "FINALIZADA" && request.finalizedDocumentId === input.documentId && request.finalizedXmlDocumentId === input.xmlDocumentId) return { requestId: request.id, token: order.trackingToken, cajaNotificationId: null as string | null, orderNotificationId: null as string | null };
    checkCaja(request, actor, request.cycle); checkVersion(request.updatedAt, input.version);
    const [openObservation] = await tx.select({ id: treasuryObservations.id }).from(treasuryObservations).where(and(eq(treasuryObservations.requestId, request.id), sql`${treasuryObservations.resolvedAt} IS NULL`)).limit(1);
    if (openObservation) throw new CajaError("Fondo Editorial debe resolver las observaciones antes de finalizar la emisión.");
    if (request.draftDocumentId !== input.documentId || request.draftXmlDocumentId !== input.xmlDocumentId) {
      throw new CajaError("Los adjuntos cambiaron. Actualiza la solicitud.");
    }
    const files = await tx.select().from(saleDocuments).where(and(
      inArray(saleDocuments.id, [input.documentId, input.xmlDocumentId]),
      eq(saleDocuments.requestId, request.id),
      eq(saleDocuments.cycle, request.cycle),
    ));
    const pdf = files.find((file) => file.id === input.documentId && file.mimeType === saleMimeTypes.pdf);
    const xml = files.find((file) => file.id === input.xmlDocumentId && file.mimeType === saleMimeTypes.xml);
    if (!pdf?.uploadedAt || !xml?.uploadedAt || !pdf.driveViewUrl || !xml.driveViewUrl) {
      throw new CajaError("Adjunta el PDF y el XML antes de finalizar.");
    }
    await tx.update(cajaRequests).set({
      status: "FINALIZADA", finalizedDocumentId: pdf.id, finalizedXmlDocumentId: xml.id, finalizedBy: actor.email, finalizedAt: new Date(),
    }).where(eq(cajaRequests.id, request.id));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "FINALIZADA", detail: "Finalizó la emisión del documento de venta." });
    const [cajaEvent] = await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle, eventType: "FINALIZADA" }).onConflictDoNothing().returning({ id: cajaNotifications.id });
    let orderNotificationId: string | null = null;
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "CAJA_FINALIZADA", detail: `Documento de venta de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"} finalizado.` });
    const requests = await tx.select().from(cajaRequests).where(eq(cajaRequests.orderId, order.id)).orderBy(asc(cajaRequests.publisherImprint));
    const required = order.orderType === "mixto" ? ["universidad", "instituto"] : [order.orderType === "solo_universidad" ? "universidad" : "instituto"];
    if (required.every((imprint) => requests.some((row) => row.publisherImprint === imprint && row.status === "FINALIZADA" && row.finalizedDocumentId))) {
      const documentIds = requests.filter((row) => required.includes(row.publisherImprint)).flatMap((row) => issuedSaleIds(row));
      const key = `${order.id}:${documentIds.join(":")}`;
      const [batch] = await tx.insert(saleDocumentBatches).values({ orderId: order.id, batchKey: key, documentIds, correction: requests.some((row) => row.cycle > 1) }).onConflictDoNothing().returning();
      if (batch) {
        const [event] = await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "DOCUMENTOS_VENTA", payload: { batchId: batch.id, correction: String(batch.correction) } }).returning({ id: orderNotifications.id });
        orderNotificationId = event.id;
      }
    }
    return { requestId: request.id, token: order.trackingToken, cajaNotificationId: cajaEvent?.id ?? null, orderNotificationId };
  }));
}
export async function returnSaleDocument(actor: AuthorizedActor, input: { id: string; version: string; reason: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertOrderOperator(tx, actor);
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado.");
    if (order.assignedTo !== actor.userId) throw new CajaError("Solo el gestor responsable puede devolver una solicitud.");
    checkVersion(request.updatedAt, input.version);
    if (request.status !== "FINALIZADA") throw new CajaError("Esta solicitud no está finalizada.");
    const [sending] = await tx.select({ id: orderNotifications.id }).from(orderNotifications).innerJoin(orderEmails, eq(orderEmails.orderId, orderNotifications.orderId)).where(and(eq(orderNotifications.orderId, order.id), eq(orderNotifications.eventType, "DOCUMENTOS_VENTA"), eq(orderNotifications.status, "ENVIANDO"), gt(orderEmails.leaseUntil, new Date()))).limit(1);
    if (sending) throw new CajaError("Los documentos se están enviando al comprador. Espera un momento antes de solicitar la corrección.");
    await tx.update(cajaRequests).set({ status: "DEVUELTA", assignedTo: null, assignedName: null, assignedAt: null, assignmentToken: null, cycle: request.cycle + 1, draftDocumentId: null, draftXmlDocumentId: null, returnReason: input.reason }).where(eq(cajaRequests.id, request.id));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "DEVUELTA", detail: `Fondo Editorial devolvió el documento: ${input.reason}` });
    const [event] = await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle + 1, eventType: "DEVUELTA", reason: input.reason }).returning({ id: cajaNotifications.id });
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "CAJA_DEVUELTA", detail: `Documento de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"} devuelto a Tesorería Recaudación: ${input.reason}` });
    return { requestId: request.id, token: order.trackingToken, cajaNotificationId: event.id };
  }));
}
function issuedSaleIds(request: Pick<typeof cajaRequests.$inferSelect, "finalizedDocumentId" | "finalizedXmlDocumentId">) {
  return [request.finalizedDocumentId, request.finalizedXmlDocumentId].filter((id): id is string => id !== null);
}

// Immutable batch membership determines attachments; never mail a mutable draft.
export async function readSaleBatch(orderId: string, batchId: string) {
  return withReadDatabase(async (db) => {
    const [batch] = await db.select().from(saleDocumentBatches).where(and(eq(saleDocumentBatches.id, batchId), eq(saleDocumentBatches.orderId, orderId)));
    if (!batch) throw new StaleDocumentBatch();
    const requests = await db.select().from(cajaRequests).where(eq(cajaRequests.orderId, orderId));
    const issuedIds = requests.flatMap(issuedSaleIds);
    if (!requests.every((row) => row.status === "FINALIZADA" && row.finalizedDocumentId) ||
      issuedIds.length !== batch.documentIds.length || !issuedIds.every((id) => batch.documentIds.includes(id))) throw new StaleDocumentBatch();
    const documents = await db.select({ document: saleDocuments, imprint: cajaRequests.publisherImprint }).from(saleDocuments).innerJoin(cajaRequests, eq(cajaRequests.id, saleDocuments.requestId)).where(inArray(saleDocuments.id, batch.documentIds)).orderBy(asc(cajaRequests.publisherImprint), asc(saleDocuments.mimeType));
    if (documents.length !== batch.documentIds.length || documents.some((row) => !row.document.uploadedAt)) throw new StaleDocumentBatch();
    return documents;
  });
}
export async function saleDocumentBytes(fileId: string, expectedHash: string, mimeType: typeof saleDocuments.$inferSelect.mimeType) {
  const bytes = await readSmallDriveFile(fileId, maxSaleFileBytes);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new CajaError("El archivo almacenado cambió. Solicita una corrección a Tesorería Recaudación.");
  if (mimeType === saleMimeTypes.pdf && receiptMimeType(bytes) !== mimeType) throw new CajaError("El archivo almacenado no es un PDF válido.");
  return bytes;
}

export async function removeSaleDraft(actor: AuthorizedActor, input: { id: string; documentId: string; cycle: number; format: SaleFormat }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado.");
    checkCaja(request, actor, input.cycle);
    const draftKey = input.format === "pdf" ? "draftDocumentId" : "draftXmlDocumentId";
    if (!request[draftKey]) return request.updatedAt.toISOString();
    if (request[draftKey] !== input.documentId) throw new CajaError("El borrador cambió. Actualiza la solicitud.");
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: input.format === "pdf" ? "PDF_RETIRADO" : "XML_RETIRADO", detail: `Retiró el borrador ${input.format.toUpperCase()}.` });
    const [updated] = await tx.update(cajaRequests).set({ [draftKey]: null }).where(eq(cajaRequests.id, request.id)).returning();
    // Immutable source stays private for audit; only remove its draft selection.
    return updated.updatedAt.toISOString();
  }));
}

export async function changeCajaAssignment(actor: AuthorizedActor, input: { id: string; version: string; operation: "claim" | "release" | "takeover"; reason: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertTreasuryOperator(tx, actor);
    const { order, request } = await lockRequest(tx, input.id);
    if (!actor.publisherImprints.includes(request.publisherImprint)) throw new CajaError("No tienes acceso a esta solicitud.");
    if (order.orderStatus === "CANCELADO" || ["FINALIZADA", "ANULADA"].includes(request.status)) throw new CajaError("La solicitud ya está cerrada.");
    if (input.operation === "claim" && request.assignedTo === actor.userId) return;
    checkVersion(request.updatedAt, input.version);
    if (input.operation === "claim" && request.assignedTo) throw new CajaError("Otra persona ya tomó la solicitud. Actualiza la página.");
    if (input.operation === "release" && !request.assignedTo) throw new CajaError("La solicitud ya está disponible.");
    if (input.operation === "takeover" && (!request.assignedTo || request.assignedTo === actor.userId)) throw new CajaError("Actualiza la atención de la solicitud.");
    if ((input.operation === "takeover" || (input.operation === "release" && request.assignedTo !== actor.userId)) && input.reason.length < 5) throw new CajaError("Indica el motivo del cambio (mínimo 5 caracteres).");
    const assignmentKey = randomUUID();
    await tx.update(cajaRequests).set(input.operation !== "release" ? { assignedTo: actor.userId, assignedName: actor.name, assignedAt: new Date(), assignmentToken: assignmentKey } : { assignedTo: null, assignedName: null, assignedAt: null, assignmentToken: null }).where(eq(cajaRequests.id, request.id));
    await tx.insert(treasuryActivity).values({ requestId: request.id, actorId: actor.userId, actorName: actor.name, event: "ASIGNACION", detail: `${input.operation === "release" ? "Liberó la solicitud" : "Tomó la atención"}. Responsable anterior: ${request.assignedName ?? "Sin asignar"}. Nuevo: ${input.operation === "release" ? "Sin asignar" : actor.name}.${input.reason ? ` Motivo: ${input.reason}` : ""}` });
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: input.operation === "release" ? "CAJA_LIBERADA" : "CAJA_ASIGNADA", detail: input.operation !== "release" ? `${actor.name} tomó la emisión de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"}.` : "La emisión está disponible para otra persona de Tesorería Recaudación." });
  }));
}
