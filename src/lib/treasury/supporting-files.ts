import "server-only";
import { eq, count } from "drizzle-orm";
import { withDatabase } from "@/db";
import { treasurySupportingFiles, treasuryActivity } from "@/db/schema";
import { assertAuthorized } from "@/lib/transaction-access";
import type { AuthorizedActor } from "@/lib/access-policy";
import { lockRequest, CajaError } from "@/lib/caja/service";
import { validateReceipt } from "@/lib/payments/inspect";
import { reserveDriveFileId, uploadFileToDrive } from "@/lib/google";
export async function uploadSupportingFile(actor: AuthorizedActor, requestId: string, uploadId: string, file: File) {
  const { bytes, hash, filename } = await validateReceipt(file);
  const previous = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor); const { order } = await lockRequest(tx, requestId);
    if (order.assignedTo !== actor.userId || order.orderStatus === "CANCELADO") throw new CajaError("Solo el gestor responsable puede añadir documentos de subsanación.");
    const [stored] = await tx.select().from(treasurySupportingFiles).where(eq(treasurySupportingFiles.id, uploadId)); return stored;
  }));
  const driveId = previous?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor); const { order } = await lockRequest(tx, requestId);
    if (order.assignedTo !== actor.userId || order.orderStatus === "CANCELADO") throw new CajaError("La atención del pedido cambió.");
    const [stored] = await tx.select().from(treasurySupportingFiles).where(eq(treasurySupportingFiles.id, uploadId));
    if (stored) { if (stored.requestId !== requestId || stored.actorId !== actor.userId || stored.contentHash !== hash) throw new CajaError("Este intento corresponde a otro archivo."); return stored; }
    const [usage] = await tx.select({ count: count() }).from(treasurySupportingFiles).where(eq(treasurySupportingFiles.requestId, requestId));
    if (usage.count >= 30) throw new CajaError("Se alcanzó el límite de documentos adicionales.");
    const [created] = await tx.insert(treasurySupportingFiles).values({ id: uploadId, requestId, driveFileId: driveId, fileName: filename, mimeType: file.type, contentHash: hash, size: file.size, actorId: actor.userId }).returning(); return created;
  }));
  const uploaded = await uploadFileToDrive({ id: intent.driveFileId, name: intent.fileName, mimeType: intent.mimeType, bytes });
  await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor); const { order } = await lockRequest(tx, requestId);
    if (order.assignedTo !== actor.userId || order.orderStatus === "CANCELADO") throw new CajaError("La atención del pedido cambió durante la carga.");
    const [ready] = await tx.select().from(treasurySupportingFiles).where(eq(treasurySupportingFiles.id, intent.id)).for("update");
    if (ready.uploadedAt) return;
    await tx.update(treasurySupportingFiles).set({ ...uploaded, uploadedAt: new Date() }).where(eq(treasurySupportingFiles.id, intent.id));
    await tx.insert(treasuryActivity).values({ requestId, actorId: actor.userId, actorName: actor.name, event: "ADJUNTO_FE", detail: "Fondo Editorial añadió un documento de subsanación." });
  })); return intent.id;
}
