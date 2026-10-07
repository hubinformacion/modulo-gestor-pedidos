import "server-only";
import { count, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orders, pickupEvidence } from "@/db/schema";
import type { AuthorizedActor } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { pickupImageSchema } from "@/lib/admin/validation";
import { validateReceipt } from "@/lib/payments/inspect";
import { reserveDriveFileId, uploadFileToDrive } from "@/lib/google";

export class PickupEvidenceError extends Error {}
function checkOrder(order: typeof orders.$inferSelect | undefined, actor: AuthorizedActor, version: string) {
  if (!order || order.assignedTo !== actor.userId || order.orderStatus !== "DESPACHADO") throw new PickupEvidenceError("Solo el gestor asignado puede adjuntar evidencia al finalizar la entrega.");
  if (order.updatedAt.toISOString() !== version) throw new PickupEvidenceError("El pedido cambió. Actualiza los datos antes de confirmar la entrega.");
}
function checkIntent(intent: typeof pickupEvidence.$inferSelect, actor: AuthorizedActor, orderId: string, hash: string) {
  if (intent.orderId !== orderId || intent.actorUserId !== actor.userId || intent.contentHash !== hash) throw new PickupEvidenceError("El archivo cambió durante el intento. Selecciónalo de nuevo.");
}

// Reserve/reuse a Drive ID before upload. Failed uploads keep the intent so a
// retry never creates a second file. External requests hold no order locks.
export async function preparePickupEvidence(actor: AuthorizedActor, orderId: string, version: string, uploadId: string, file: File) {
  const parsed = pickupImageSchema.safeParse(file);
  if (!parsed.success) throw new PickupEvidenceError(parsed.error.issues[0].message);
  let inspected: Awaited<ReturnType<typeof validateReceipt>>;
  try { inspected = await validateReceipt(file); }
  catch { throw new PickupEvidenceError("La imagen no es un JPG o PNG válido."); }
  const { bytes, filename, hash } = inspected;
  const existing = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("share");
    checkOrder(order, actor, version);
    const [intent] = await tx.select().from(pickupEvidence).where(eq(pickupEvidence.id, uploadId));
    if (intent) checkIntent(intent, actor, orderId, hash);
    return { intent, number: order.orderNumber };
  }));
  const driveId = existing.intent?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    await assertAuthorized(tx, actor);
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    checkOrder(order, actor, version);
    const [stored] = await tx.select().from(pickupEvidence).where(eq(pickupEvidence.id, uploadId));
    if (stored) { checkIntent(stored, actor, orderId, hash); return stored; }
    const [usage] = await tx.select({ total: count() }).from(pickupEvidence).where(eq(pickupEvidence.orderId, orderId));
    if (usage.total >= 5) throw new PickupEvidenceError("Se alcanzó el límite de imágenes de este pedido. Puedes confirmar sin imagen o consultar al equipo.");
    const [created] = await tx.insert(pickupEvidence).values({ id: uploadId, orderId, actorUserId: actor.userId, actorName: actor.name, driveFileId: driveId, fileName: filename, mimeType: file.type, contentHash: hash, size: file.size }).returning();
    return created;
  }));
  if (!intent.driveViewUrl) {
    const uploaded = await uploadFileToDrive({ id: intent.driveFileId, name: `${existing.number}-evidencia-entrega-${filename}`, mimeType: intent.mimeType, bytes });
    await withDatabase((db) => db.transaction(async (tx) => {
      await assertAuthorized(tx, actor);
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("share");
      checkOrder(order, actor, version);
      await tx.update(pickupEvidence).set({ driveViewUrl: uploaded.driveViewUrl, uploadedAt: new Date() }).where(eq(pickupEvidence.id, intent.id));
    }));
  }
  return intent.id;
}
