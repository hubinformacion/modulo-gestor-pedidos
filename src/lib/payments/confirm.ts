import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { z } from "zod";
import { withDatabase } from "@/db";
import { orderNotifications, orders, paymentReceipts } from "@/db/schema";
import { OrderInputError } from "@/lib/orders/submission";
import { confirmReceiptSchema } from "./validation";

export async function confirmReceipt(input: z.infer<typeof confirmReceiptSchema>) {
  return withDatabase((db) => db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.trackingToken, input.token)).for("update");
    if (!order) throw new OrderInputError("No encontramos el pedido.");
    const status = input.imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
    if (order.orderStatus !== "PENDIENTE_PAGO" || status === "NO_APLICA" || status === "VERIFICADO") throw new OrderInputError("Este sello no admite nuevos comprobantes.");
    const [receipt] = await tx.select().from(paymentReceipts).where(and(eq(paymentReceipts.orderId, order.id), eq(paymentReceipts.publisherImprint, input.imprint))).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id)).limit(1);
    if (!receipt) throw new OrderInputError("Adjunta y espera a que se cargue un comprobante antes de confirmar.");
    if (status === "EN_REVISION") {
      const [notification] = await tx.select({ id: orderNotifications.id }).from(orderNotifications).where(and(eq(orderNotifications.orderId, order.id), eq(orderNotifications.receiptId, receipt.id), eq(orderNotifications.eventType, "COMPROBANTE_RECIBIDO"))).limit(1);
      if (notification) return notification.id;
      throw new OrderInputError("Los comprobantes de este sello ya están en revisión.");
    }
    const previous = input.imprint === "universidad" ? order.submittedReceiptUniversidad : order.submittedReceiptInstituto;
    if (receipt.id === previous) throw new OrderInputError("Adjunta un nuevo comprobante para reemplazar el rechazado.");
    await tx.update(orders).set(input.imprint === "universidad" ? { paymentStatusUniversidad: "EN_REVISION", submittedReceiptUniversidad: receipt.id } : { paymentStatusInstituto: "EN_REVISION", submittedReceiptInstituto: receipt.id }).where(eq(orders.id, order.id));
    const [notification] = await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "COMPROBANTE_RECIBIDO", publisherImprint: input.imprint, receiptId: receipt.id }).returning({ id: orderNotifications.id });
    return notification.id;
  }));
}
