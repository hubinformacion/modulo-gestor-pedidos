import type { Database } from "@/db";
import { books, cajaNotifications, cajaRequests, couponRedemptions, coupons, orderActivity, orderEmails, orderItems, orderNotifications, orders } from "@/db/schema";
import { assertOrderOperator } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { CancellationError, type CancellationInput } from "@/modules/orders/domain/cancellation";
import { canBuyerCancel } from "@/modules/orders/domain/cancellation-validation";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import "server-only";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function cancelPurchaseRecord(tx: Transaction, input: CancellationInput, actor?: AuthorizedActor) {
  if (actor) await assertOrderOperator(tx, actor);
  const [order] = await tx.select().from(orders).where(actor ? eq(orders.id, input.id!) : eq(orders.trackingToken, input.token!)).for("update");
  if (!order) throw new CancellationError("No encontramos el pedido.");
  if (actor && order.assignedTo !== actor.userId) throw new CancellationError("Toma la atención del pedido antes de anularlo.");
  if (order.orderStatus === "CANCELADO") return { token: order.trackingToken, cajaEvents: [] as { requestId: string; notificationId: string }[], notificationId: null as string | null };
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
  if (order.couponId && ![order.paymentStatusUniversidad, order.paymentStatusInstituto].includes("VERIFICADO")) {
    const [redemption] = await tx.select().from(couponRedemptions).where(eq(couponRedemptions.orderId, order.id));
    if (redemption && !redemption.releasedAt) {
      const [coupon] = await tx.select().from(coupons).where(eq(coupons.id, redemption.couponId)).for("update");
      if (!coupon || coupon.usedCount < 1) throw new CancellationError("Revisa el cupón de este pedido antes de anularlo.");
      await tx.update(coupons).set({ usedCount: coupon.usedCount - 1 }).where(eq(coupons.id, coupon.id));
      await tx.update(couponRedemptions).set({ releasedAt: now }).where(eq(couponRedemptions.orderId, order.id));
    }
  }
  await tx.update(orders).set({ orderStatus: "CANCELADO", cancelledAt: now, cancellationSource: actor ? "gestor" : "comprador", cancellationReason: input.reason || null, stockRestoredAt: order.stockRestoredAt ?? now }).where(eq(orders.id, order.id));
  await tx.update(orderNotifications).set({ status: "OMITIDO" }).where(and(eq(orderNotifications.orderId, order.id), inArray(orderNotifications.status, ["NO_ENVIADO", "ERROR"])));
  const [event] = await tx.insert(orderNotifications).values({ orderId: order.id, eventType: "CANCELADO", payload: { source: actor ? "gestor" : "comprador", reason: input.reason } }).returning({ id: orderNotifications.id });
  const cajaEvents: { requestId: string; notificationId: string }[] = [];
  const requests = await tx.select().from(cajaRequests).where(eq(cajaRequests.orderId, order.id)).for("update");
  for (const request of requests) {
    await tx.update(cajaRequests).set({ status: "ANULADA" }).where(eq(cajaRequests.id, request.id));
    await tx.update(cajaNotifications).set({ status: "OMITIDO" }).where(and(eq(cajaNotifications.requestId, request.id), inArray(cajaNotifications.status, ["NO_ENVIADO", "ERROR"])));
    const [notice] = await tx.insert(cajaNotifications).values({ requestId: request.id, cycle: request.cycle, eventType: "ANULADA", reason: input.reason || "Pedido cancelado." }).onConflictDoNothing().returning({ id: cajaNotifications.id });
    if (notice) cajaEvents.push({ requestId: request.id, notificationId: notice.id });
  }
  await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor?.userId ?? null, actorName: actor?.name ?? "Comprador", eventType: "CANCELADO", detail: `${actor ? "Fondo Editorial anuló" : "El comprador canceló"} el pedido.${input.reason ? ` Motivo: ${input.reason}` : ""}` });
  return { token: order.trackingToken, notificationId: event.id, cajaEvents };
}
