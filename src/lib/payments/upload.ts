import "server-only";
import { createHash } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { orders, paymentReceipts, paymentUploads } from "@/db/schema";
import { readFileFromDrive, reserveDriveFileId, uploadFileToDrive } from "@/lib/google";
import { OrderInputError } from "@/lib/orders/submission";
import type { z } from "zod";
import { maxReceiptBytes, receiptMetadataSchema } from "./validation";
import { validateReceipt } from "./inspect";

function ensureWritable(order: typeof orders.$inferSelect, imprint: "universidad" | "instituto") {
  const status = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
  if (order.orderStatus !== "PENDIENTE_PAGO" || (status !== "PENDIENTE" && status !== "RECHAZADO")) throw new OrderInputError("Este sello no admite nuevos comprobantes.");
}

export async function uploadReceipt(metadata: z.infer<typeof receiptMetadataSchema>, file: File) {
  const { bytes, filename, hash } = await validateReceipt(file);
  const current = await withDatabase(async (db) => {
    const [order] = await db.select().from(orders).where(eq(orders.trackingToken, metadata.token));
    if (!order) throw new OrderInputError("No encontramos el pedido.");
    const [intent] = await db.select().from(paymentUploads).where(eq(paymentUploads.id, metadata.uploadId));
    if (intent && (intent.orderId !== order.id || intent.publisherImprint !== metadata.imprint || intent.contentHash !== hash)) throw new OrderInputError("El archivo o sello cambió durante el intento. Retira el archivo y añádelo nuevamente.");
    const [receipt] = await db.select({ id: paymentReceipts.id }).from(paymentReceipts).where(eq(paymentReceipts.uploadId, metadata.uploadId));
    return { order, intent, receipt };
  });
  if (current.receipt) return current.receipt.id;
  ensureWritable(current.order, metadata.imprint);
  const driveId = current.intent?.driveFileId ?? await reserveDriveFileId();
  const intent = await withDatabase((db) => db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, current.order.id)).for("update");
    ensureWritable(order, metadata.imprint);
    const [existing] = await tx.select().from(paymentUploads).where(eq(paymentUploads.id, metadata.uploadId));
    if (existing) {
      if (existing.orderId !== order.id || existing.publisherImprint !== metadata.imprint || existing.contentHash !== hash) throw new OrderInputError("El archivo o sello cambió. Retíralo y añádelo nuevamente.");
      return existing;
    }
    const [usage] = await tx.select({ count: count() }).from(paymentUploads).where(eq(paymentUploads.orderId, order.id));
    if (usage.count >= 30) throw new OrderInputError("Se alcanzó el límite de comprobantes del pedido. Contacta al equipo para continuar.");
    const [created] = await tx.insert(paymentUploads).values({ id: metadata.uploadId, orderId: order.id, publisherImprint: metadata.imprint, contentHash: hash, driveFileId: driveId, fileName: filename, mimeType: file.type, size: file.size }).returning();
    return created;
  }));
  // External calls never hold the order lock. Keep the intent if Drive or DB fails.
  const uploaded = await uploadFileToDrive({ id: intent.driveFileId, name: `${current.order.orderNumber}-${metadata.imprint}-${filename}`, mimeType: intent.mimeType, bytes });
  return finalizeReceipt(intent, uploaded);
}

async function finalizeReceipt(intent: typeof paymentUploads.$inferSelect, uploaded: { driveFileId: string; driveViewUrl: string }) {
  return withDatabase((db) => db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, intent.orderId)).for("update");
    if (!order) throw new OrderInputError("No encontramos el pedido.");
    const [existing] = await tx.select({ id: paymentReceipts.id }).from(paymentReceipts).where(eq(paymentReceipts.uploadId, intent.id));
    if (existing) return existing.id;
    ensureWritable(order, intent.publisherImprint);
    const [receipt] = await tx.insert(paymentReceipts).values({ orderId: order.id, uploadId: intent.id, publisherImprint: intent.publisherImprint, ...uploaded, fileName: intent.fileName }).returning({ id: paymentReceipts.id });
    return receipt.id;
  }));
}

// Internal recovery of a durable intent. Verify the stored size/hash before
// registering a file already on Drive; never approve a payment or send mail.
export async function recoverReceiptUpload(uploadId: string) {
  const current = await withDatabase(async (db) => {
    const [intent] = await db.select().from(paymentUploads).where(eq(paymentUploads.id, uploadId));
    if (!intent) throw new OrderInputError("No encontramos el intento de carga.");
    const [order] = await db.select().from(orders).where(eq(orders.id, intent.orderId));
    if (!order) throw new OrderInputError("No encontramos el pedido.");
    const [receipt] = await db.select({ id: paymentReceipts.id }).from(paymentReceipts).where(eq(paymentReceipts.uploadId, uploadId));
    return { intent, order, receipt };
  });
  if (current.receipt) return current.receipt.id;
  ensureWritable(current.order, current.intent.publisherImprint);
  const stream = await readFileFromDrive(current.intent.driveFileId);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of stream) {
    const bytes = Buffer.from(chunk);
    size += bytes.length;
    if (size > maxReceiptBytes || size > current.intent.size) { stream.destroy(); throw new OrderInputError("El archivo guardado no coincide con el intento original."); }
    chunks.push(bytes);
  }
  const bytes = Buffer.concat(chunks);
  if (size !== current.intent.size || createHash("sha256").update(bytes).digest("hex") !== current.intent.contentHash) throw new OrderInputError("El archivo guardado no coincide con el intento original.");
  const uploaded = await uploadFileToDrive({ id: current.intent.driveFileId, name: `${current.order.orderNumber}-${current.intent.publisherImprint}-${current.intent.fileName}`, mimeType: current.intent.mimeType, bytes });
  return finalizeReceipt(current.intent, uploaded);
}
