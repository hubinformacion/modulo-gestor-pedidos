import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, cajaNotifications, cajaRequests, orderActivity, orderEmails, orderItems, orderNotifications, orders } from "@/db/schema";
import { assertAuthorized } from "@/lib/transaction-access";
import type { AuthorizedActor } from "@/lib/access-policy";
import { canBuyerCancel } from "./cancellation-validation";
export class CancellationError extends Error {}
export async function cancelPurchase(input: { token?: string; id?: string; version: string; reason: string }, actor?: AuthorizedActor) {
  return withDatabase((db) => db.transaction(async (tx) => {
    if (actor) await assertAuthorized(tx, actor);
    const [order] = await tx.select().from(orders).where(actor ? eq(orders.id, input.id!) : eq(orders.trackingToken, input.token!)).for("update");
    if (!order) throw new CancellationError("No encontramos el pedido.");
    if (actor && order.assignedTo !== actor.userId) throw new CancellationError("Toma la atención del pedido antes de anularlo.");
    if (order.orderStatus === "CANCELADO") return { token: order.trackingToken, requestIds: [] as string[] };
    if (order.updatedAt.toISOString() !== input.version) throw new CancellationError("El pedido cambió. Actualiza la página antes de continuar.");
    if (actor ? !["PENDIENTE_PAGO", "EN_PREPARACION"].includes(order.orderStatus) : !canBuyerCancel(order)) throw new CancellationError(actor ? "Solo se puede anular antes del despacho." : "El pedido ya tiene un pago verificado. Contacta al Fondo Editorial.");
    const [sending] = await tx.select({ id: orderNotifications.id }).from(orderNotifications).innerJoin(orderEmails, eq(orderEmails.orderId, orderNotifications.orderId)).where(and(eq(orderNotifications.orderId, order.id), eq(orderNotifications.eventType, "DOCUMENTOS_VENTA"), eq(orderNotifications.status, "ENVIANDO"), gt(orderEmails.leaseUntil, new Date()))).limit(1);
    if (sending) throw new CancellationError("Se están enviando los documentos de venta. Espera un momento y reintenta.");
    const items = await tx.select({ bookId: orderItems.bookId, quantity: sql<number>`sum(${orderItems.quantity})::int` }).from(orderItems).where(eq(orderItems.orderId, order.id)).groupBy(orderItems.bookId).orderBy(asc(orderItems.bookId));
    if (!order.stockRestoredAt && items.length) {
      const stock = await tx.select().from(books).where(inArray(books.id, items.map((item) => item.bookId))).orderBy(asc(books.id)).for("update");
      for (const item of items) {
        const book = stock.find((row) => row.id === item.bookId);
        if (!book || book.stock + item.quantity > 2147483647) throw new CancellationError("Revisa el inventario antes de anular este pedido.");
        await tx.update(books).set({ stock: book.stock + item.quantity }).where(eq(books.id, book.id));
      }
    }
    const now = new Date();
    await tx.update(orders).set({ orderStatus: "CANCELADO", cancelledAt: now, cancellationSource: actor ? "gestor" : "comprador", cancellationReason: input.reason || null, stockRestoredAt: order.stockRestoredAt ?? now }).where(eq(orders.id, order.id));
    await tx.update(orderNotifications).set({ status: "OMITIDO" }).where(and(eq(orderNotifications.orderId, order.id), inArray(orderNotifications.status, ["PENDIENTE", "ERROR"])));
    await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "CANCELADO", payload: { source: actor ? "gestor" : "comprador", reason: input.reason } });
    const requests = await tx.select().from(cajaRequests).where(eq(cajaRequests.orderId, order.id)).for("update");
    for (const request of requests) {
      await tx.update(cajaRequests).set({ status: "ANULADA" }).where(eq(cajaRequests.id, request.id));
      await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(and(eq(cajaNotifications.requestId, request.id), inArray(cajaNotifications.status, ["PENDIENTE", "ERROR"])));
      await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle, eventType: "ANULADA", reason: input.reason || "Pedido cancelado." }).onConflictDoNothing();
    }
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor?.userId ?? null, actorName: actor?.name ?? "Comprador", eventType: "CANCELADO", detail: `${actor ? "Fondo Editorial anuló" : "El comprador canceló"} el pedido.${input.reason ? ` Motivo: ${input.reason}` : ""}` });
    return { token: order.trackingToken, requestIds: requests.map((row) => row.id) };
  }));
}
