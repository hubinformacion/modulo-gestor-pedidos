import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, eq, gt, inArray } from "drizzle-orm";
import { withDatabase, withReadDatabase, type Database } from "@/db";
import { cajaNotifications, cajaRequests, orderActivity, orderEmails, orderNotifications, orders, saleDocumentBatches, saleDocuments } from "@/db/schema";
import { assertAccessRole, assertAuthorized } from "@/lib/transaction-access";
import type { AuthorizedActor } from "@/lib/access-policy";
import { reserveDriveFileId, uploadFileToDrive } from "@/lib/google";
import { validateReceipt } from "@/lib/payments/inspect";
import { pdfSchema } from "./validation";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export class CajaError extends Error {}
export class StaleDocumentBatch extends Error {}

export async function createCajaRequest(tx: Transaction, orderId: string, imprint: "universidad" | "instituto") {
  const [request] = await tx.insert(cajaRequests).values({ orderId, publisherImprint: imprint }).onConflictDoNothing().returning();
  if (request) await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: 1, eventType: "SOLICITUD" });
}
async function lockRequest(tx: Transaction, id: string) {
  const [reference] = await tx.select({ orderId: cajaRequests.orderId }).from(cajaRequests).where(eq(cajaRequests.id, id));
  if (!reference) throw new CajaError("La solicitud no existe.");
  // All revisions of a mixed order serialize on its order, independently of
  // distribution state; this makes the all-PDF readiness check atomic.
  const [order] = await tx.select().from(orders).where(eq(orders.id, reference.orderId)).for("update");
  const [request] = await tx.select().from(cajaRequests).where(eq(cajaRequests.id, id)).for("update");
  return { order, request };
}
function checkCaja(request: typeof cajaRequests.$inferSelect, actor: AuthorizedActor, cycle: number) {
  if (actor.publisherImprint !== request.publisherImprint) throw new CajaError("No tienes acceso a esta solicitud.");
  if (request.assignedTo !== actor.userId) throw new CajaError("Toma la atención de la solicitud para modificar su PDF.");
  if (request.cycle !== cycle || ["FINALIZADA", "ANULADA"].includes(request.status)) throw new CajaError("La solicitud cambió o ya fue finalizada. Actualiza la página.");
}
function checkVersion(actual: Date, expected: string) {
  if (actual.toISOString() !== expected) throw new CajaError("La solicitud cambió. Actualiza los datos antes de continuar.");
}
export async function uploadSaleDocument(actor: AuthorizedActor, id: string, uploadId: string, cycle: number, file: File) {
  const parsed = pdfSchema.safeParse(file);
  if (!parsed.success) throw new CajaError(parsed.error.issues[0].message);
  const { bytes, hash } = await validateReceipt(file).catch(() => { throw new CajaError("El archivo no es un PDF válido."); });
  const filename = file.name;
  const previous = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    const [document] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    return { document, token: request.assignmentToken };
  }));
  const driveFileId = previous.document?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { order, request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    if (request.assignmentToken !== previous.token) throw new CajaError("La atención cambió durante la carga. Actualiza la solicitud.");
    const [stored] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, uploadId));
    if (stored) {
      if (stored.requestId !== id || stored.cycle !== cycle || stored.actorEmail !== actor.email || stored.contentHash !== hash || stored.fileName !== filename) throw new CajaError("El intento no corresponde a este PDF. Selecciónalo de nuevo.");
      return { document: stored, number: order.orderNumber };
    }
    const [usage] = await tx.select({ total: count() }).from(saleDocuments).where(and(eq(saleDocuments.requestId, id), eq(saleDocuments.cycle, cycle)));
    if (usage.total >= 10) throw new CajaError("Se alcanzó el límite de archivos de esta revisión. Contacta al gestor.");
    const [document] = await tx.insert(saleDocuments).values({ id: uploadId, requestId: id, cycle, actorEmail: actor.email, driveFileId, contentHash: hash, fileName: filename, size: file.size }).returning();
    return { document, number: order.orderNumber };
  }));
  const uploaded = intent.document.driveViewUrl ? { driveViewUrl: intent.document.driveViewUrl } : await uploadFileToDrive({ id: intent.document.driveFileId, name: filename, mimeType: "application/pdf", bytes });
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { request } = await lockRequest(tx, id);
    checkCaja(request, actor, cycle);
    if (request.assignmentToken !== previous.token) throw new CajaError("La atención cambió durante la carga. Actualiza la solicitud.");
    await tx.update(saleDocuments).set({ driveViewUrl: uploaded.driveViewUrl, uploadedAt: intent.document.uploadedAt ?? new Date() }).where(eq(saleDocuments.id, uploadId));
    // An already persisted retry must not replace a newer draft.
    if (intent.document.uploadedAt && request.draftDocumentId !== uploadId) throw new CajaError("Hay un PDF más reciente. Actualiza la solicitud.");
    const [updated] = await tx.update(cajaRequests).set({ draftDocumentId: uploadId }).where(eq(cajaRequests.id, id)).returning();
    return { documentId: uploadId, fileName: filename, version: updated.updatedAt.toISOString(), driveFileId: intent.document.driveFileId, driveViewUrl: uploaded.driveViewUrl };
  }));
}
export async function finalizeSaleDocument(actor: AuthorizedActor, input: { id: string; version: string; documentId: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado. No admite emisión de documentos.");
    if (actor.publisherImprint !== request.publisherImprint) throw new CajaError("No tienes acceso a esta solicitud.");
    if (request.assignedTo !== actor.userId) throw new CajaError("Solo el responsable de caja puede finalizar esta solicitud.");
    if (request.status === "FINALIZADA" && request.finalizedDocumentId === input.documentId) return { requestId: request.id, token: order.trackingToken };
    checkCaja(request, actor, request.cycle); checkVersion(request.updatedAt, input.version);
    const [document] = await tx.select().from(saleDocuments).where(eq(saleDocuments.id, input.documentId));
    if (!document?.uploadedAt || document.requestId !== request.id || document.cycle !== request.cycle || request.draftDocumentId !== document.id) throw new CajaError("Adjunta y revisa el PDF antes de finalizar.");
    await tx.update(cajaRequests).set({ status: "FINALIZADA", finalizedDocumentId: document.id, finalizedBy: actor.email, finalizedAt: new Date() }).where(eq(cajaRequests.id, request.id));
    await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle, eventType: "FINALIZADA" }).onConflictDoNothing();
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "CAJA_FINALIZADA", detail: `Documento de venta de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"} finalizado.` });
    const requests = await tx.select().from(cajaRequests).where(eq(cajaRequests.orderId, order.id)).orderBy(asc(cajaRequests.publisherImprint));
    const required = order.orderType === "mixto" ? ["universidad", "instituto"] : [order.orderType === "solo_universidad" ? "universidad" : "instituto"];
    if (required.every((imprint) => requests.some((row) => row.publisherImprint === imprint && row.status === "FINALIZADA" && row.finalizedDocumentId))) {
      const documentIds = requests.filter((row) => required.includes(row.publisherImprint)).map((row) => row.finalizedDocumentId!);
      const key = `${order.id}:${documentIds.join(":")}`;
      const [batch] = await tx.insert(saleDocumentBatches).values({ orderId: order.id, batchKey: key, documentIds, correction: requests.some((row) => row.cycle > 1) }).onConflictDoNothing().returning();
      if (batch) await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "DOCUMENTOS_VENTA", payload: { batchId: batch.id, correction: String(batch.correction) } });
    }
    return { requestId: request.id, token: order.trackingToken };
  }));
}
export async function returnSaleDocument(actor: AuthorizedActor, input: { id: string; version: string; reason: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado.");
    if (order.assignedTo !== actor.userId) throw new CajaError("Solo el gestor responsable puede devolver una solicitud.");
    checkVersion(request.updatedAt, input.version);
    if (request.status !== "FINALIZADA") throw new CajaError("Esta solicitud no está finalizada.");
    const [sending] = await tx.select({ id: orderNotifications.id }).from(orderNotifications).innerJoin(orderEmails, eq(orderEmails.orderId, orderNotifications.orderId)).where(and(eq(orderNotifications.orderId, order.id), eq(orderNotifications.eventType, "DOCUMENTOS_VENTA"), eq(orderNotifications.status, "ENVIANDO"), gt(orderEmails.leaseUntil, new Date()))).limit(1);
    if (sending) throw new CajaError("Los documentos se están enviando al comprador. Espera un momento antes de solicitar la corrección.");
    await tx.update(cajaRequests).set({ status: "DEVUELTA", assignedTo: null, assignedName: null, assignedAt: null, assignmentToken: null, cycle: request.cycle + 1, draftDocumentId: null, returnReason: input.reason }).where(eq(cajaRequests.id, request.id));
    await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle + 1, eventType: "DEVUELTA", reason: input.reason });
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "CAJA_DEVUELTA", detail: `Documento de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"} devuelto a caja: ${input.reason}` });
    return { requestId: request.id, token: order.trackingToken };
  }));
}
// Serialize the transition to sending with correction requests. The lease
// guards the external Gmail call without holding a business lock during I/O.
export async function beginSaleDelivery(event: typeof orderNotifications.$inferSelect) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, event.orderId)).for("update");
    const [batch] = await tx.select().from(saleDocumentBatches).where(and(eq(saleDocumentBatches.id, event.payload.batchId), eq(saleDocumentBatches.orderId, event.orderId)));
    const requests = await tx.select().from(cajaRequests).where(eq(cajaRequests.orderId, event.orderId));
    const valid = batch && requests.length === batch.documentIds.length && requests.every((row) => row.status === "FINALIZADA" && row.finalizedDocumentId && batch.documentIds.includes(row.finalizedDocumentId));
    await tx.update(orderNotifications).set(valid ? { status: "ENVIANDO", attempts: event.attempts + 1, lastAttemptAt: new Date() } : { status: "OMITIDO" }).where(eq(orderNotifications.id, event.id));
    return Boolean(valid);
  }));
}
// Immutable batch membership determines attachments; never mail a mutable draft.
export async function readSaleBatch(orderId: string, batchId: string) {
  return withReadDatabase(async (db) => {
    const [batch] = await db.select().from(saleDocumentBatches).where(and(eq(saleDocumentBatches.id, batchId), eq(saleDocumentBatches.orderId, orderId)));
    if (!batch) throw new StaleDocumentBatch();
    const requests = await db.select().from(cajaRequests).where(eq(cajaRequests.orderId, orderId));
    if (requests.length !== batch.documentIds.length || !requests.every((row) => row.status === "FINALIZADA" && row.finalizedDocumentId && batch.documentIds.includes(row.finalizedDocumentId))) throw new StaleDocumentBatch();
    const documents = await db.select({ document: saleDocuments, imprint: cajaRequests.publisherImprint }).from(saleDocuments).innerJoin(cajaRequests, eq(cajaRequests.id, saleDocuments.requestId)).where(inArray(saleDocuments.id, batch.documentIds)).orderBy(asc(cajaRequests.publisherImprint));
    if (documents.length !== batch.documentIds.length || documents.some((row) => !row.document.uploadedAt)) throw new StaleDocumentBatch();
    return documents;
  });
}
export async function salePdfBytes(fileId: string, expectedHash: string) {
  const { readFileFromDrive } = await import("@/lib/google");
  const stream = await readFileFromDrive(fileId);
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of stream) { const bytes = Buffer.from(chunk); size += bytes.length; if (size > 3 * 1024 * 1024) { stream.destroy(); throw new CajaError("El PDF excede el tamaño permitido."); } chunks.push(bytes); }
  const result = Buffer.concat(chunks);
  if (!result.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new CajaError("El archivo almacenado no es un PDF válido.");
  if (createHash("sha256").update(result).digest("hex") !== expectedHash) throw new CajaError("El PDF almacenado cambió. Solicita una corrección a caja.");
  return result;
}

export async function removeSaleDraft(actor: AuthorizedActor, input: { id: string; documentId: string; cycle: number }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { order, request } = await lockRequest(tx, input.id);
    if (order.orderStatus === "CANCELADO") throw new CajaError("El pedido fue anulado.");
    checkCaja(request, actor, input.cycle);
    if (!request.draftDocumentId) return request.updatedAt.toISOString();
    if (request.draftDocumentId !== input.documentId) throw new CajaError("El borrador cambió. Actualiza la solicitud.");
    const [updated] = await tx.update(cajaRequests).set({ draftDocumentId: null }).where(eq(cajaRequests.id, request.id)).returning();
    // Immutable source stays private for audit; only remove its draft selection.
    return updated.updatedAt.toISOString();
  }));
}

export async function changeCajaAssignment(actor: AuthorizedActor, input: { id: string; version: string; operation: "claim" | "release" }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    await assertAccessRole(tx, actor, "caja");
    const { order, request } = await lockRequest(tx, input.id);
    if (request.publisherImprint !== actor.publisherImprint) throw new CajaError("No tienes acceso a esta solicitud.");
    if (order.orderStatus === "CANCELADO" || ["FINALIZADA", "ANULADA"].includes(request.status)) throw new CajaError("La solicitud ya está cerrada.");
    if (input.operation === "claim" && request.assignedTo === actor.userId) return;
    checkVersion(request.updatedAt, input.version);
    if (input.operation === "claim" && request.assignedTo) throw new CajaError("Otra persona ya tomó la solicitud. Actualiza la página.");
    if (input.operation === "release" && request.assignedTo !== actor.userId) throw new CajaError("Solo el responsable puede liberar la solicitud.");
    await tx.update(cajaRequests).set(input.operation === "claim" ? { assignedTo: actor.userId, assignedName: actor.name, assignedAt: new Date(), assignmentToken: randomUUID() } : { assignedTo: null, assignedName: null, assignedAt: null, assignmentToken: null }).where(eq(cajaRequests.id, request.id));
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: input.operation === "claim" ? "CAJA_ASIGNADA" : "CAJA_LIBERADA", detail: input.operation === "claim" ? `${actor.name} tomó la emisión de ${request.publisherImprint === "universidad" ? "Universidad" : "Instituto"}.` : "La emisión está disponible para otra persona de caja." });
  }));
}
