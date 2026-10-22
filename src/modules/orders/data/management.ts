import type { Database } from "@/db";
import { campuses, orderActivity, orderNotifications, orders, paymentReceipts, pickupContacts, pickupEvidence, pickupNotifications } from "@/db/schema";
import { assertOrderOperator } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { resolveOrderLocation } from "@/modules/orders/data/location";
import { assignmentSchema, dispatchSchema, internalNoteSchema, reviewSchema } from "@/modules/orders/domain/management";
import { OperationError, checkVersion } from "@/modules/orders/domain/operation-error";
import { createCajaRequest } from "@/modules/treasury/data/requests";
import { desc, eq } from "drizzle-orm";
import "server-only";
import { z } from "zod";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function reviewPaymentRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof reviewSchema>) {
  await assertOrderOperator(tx, actor);
  const [order] = await tx.select().from(orders).where(eq(orders.id, data.id)).for("update");
  if (!order) throw new OperationError("El pedido no existe.");
  checkVersion(order.updatedAt, data.version);
  if (order.assignedTo !== actor.userId) throw new OperationError("Toma la atención del pedido para actualizarlo. Si está asignado a otro gestor, solo puedes consultarlo.");
  const status = data.imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
  if (order.orderStatus !== "PENDIENTE_PAGO" || status !== "EN_REVISION") throw new OperationError("Este pago ya no está pendiente de revisión.");
  const receipts = await tx.select().from(paymentReceipts).where(eq(paymentReceipts.orderId, order.id)).orderBy(desc(paymentReceipts.uploadedAt), desc(paymentReceipts.id));
  if (receipts.find((row) => row.publisherImprint === data.imprint)?.id !== data.receiptId) throw new OperationError("Hay un comprobante más reciente. Actualiza la página y revísalo.");
  const universidad = data.imprint === "universidad" ? data.decision : order.paymentStatusUniversidad;
  const instituto = data.imprint === "instituto" ? data.decision : order.paymentStatusInstituto;
  const complete = [universidad, instituto].every((value) => value === "NO_APLICA" || value === "VERIFICADO");
  await tx.update(orders).set({ paymentStatusUniversidad: universidad, paymentStatusInstituto: instituto, orderStatus: complete ? "EN_PREPARACION" : "PENDIENTE_PAGO", ...(data.imprint === "universidad" ? { rejectionUniversidad: data.decision === "RECHAZADO" ? data.reason : null } : { rejectionInstituto: data.decision === "RECHAZADO" ? data.reason : null }) }).where(eq(orders.id, order.id));
  const cajaEvent = data.decision === "VERIFICADO" ? await createCajaRequest(tx, order.id, data.imprint) : null;
  const notify = data.decision === "RECHAZADO" || complete;
  const [notification] = notify ? await tx.insert(orderNotifications).values({ orderId: order.id, eventType: data.decision === "VERIFICADO" ? "PAGO_VERIFICADO" : "PAGO_RECHAZADO", publisherImprint: data.imprint, receiptId: data.receiptId, payload: { reason: data.reason, orderStatus: complete ? "EN_PREPARACION" : "PENDIENTE_PAGO", ...(complete && order.orderType === "mixto" ? { scope: "pedido" } : {}) } }).returning({ id: orderNotifications.id }) : [];
  await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: data.decision === "VERIFICADO" ? "PAGO_VERIFICADO" : "PAGO_RECHAZADO", detail: data.decision === "VERIFICADO" ? `Pago de ${data.imprint === "universidad" ? "Universidad" : "Instituto"} verificado.${complete ? " Iniciamos la distribución." : ""}` : `Comprobante de ${data.imprint === "universidad" ? "Universidad" : "Instituto"} rechazado: ${data.reason}` });
  return { token: order.trackingToken, notificationId: notification?.id ?? null, cajaEvent };

}

export async function dispatchOrderRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof dispatchSchema>) {
  const evidenceId = data.evidenceId;

  await assertOrderOperator(tx, actor);
  const [order] = await tx.select().from(orders).where(eq(orders.id, data.id)).for("update");
  if (!order) throw new OperationError("El pedido no existe.");
  checkVersion(order.updatedAt, data.version);
  if (order.assignedTo !== actor.userId) throw new OperationError("Toma la atención del pedido para actualizarlo. Si está asignado a otro gestor, solo puedes consultarlo.");
  if (![order.paymentStatusUniversidad, order.paymentStatusInstituto].every((status) => status === "NO_APLICA" || status === "VERIFICADO")) throw new OperationError("Verifica todos los pagos requeridos antes de despachar.");
  const expected = data.status === "DESPACHADO" ? "EN_PREPARACION" : "DESPACHADO";
  if (order.orderStatus !== expected) throw new OperationError("El pedido no admite ese cambio de estado.");
  if (data.status === "DESPACHADO" && order.deliveryType === "delivery" && !data.courier) throw new OperationError("Indica el courier para el envío a domicilio.");
  if (evidenceId) {
    const [proof] = await tx.select().from(pickupEvidence).where(eq(pickupEvidence.id, evidenceId)).for("update");
    if (!proof || proof.orderId !== order.id || !proof.driveViewUrl || !proof.uploadedAt || data.status !== "ENTREGADO") throw new OperationError("La imagen aún no está lista. Reintenta sin retirarla.");
    await tx.update(pickupEvidence).set({ confirmedAt: new Date() }).where(eq(pickupEvidence.id, proof.id));
  }
  const pickupDispatch = data.status === "DESPACHADO" && order.deliveryType === "recojo_campus";
  const [support] = pickupDispatch && data.supportContactId ? await tx.select().from(pickupContacts).where(eq(pickupContacts.id, data.supportContactId)).for("share") : [];
  if (pickupDispatch && (!support || support.status !== "ACTIVO")) throw new OperationError("Selecciona una persona activa para apoyar con el recojo.");
  if (support && support.email === order.customerEmail.toLowerCase()) throw new OperationError("Selecciona a una persona de apoyo distinta del comprador.");
  let supportNotificationId: string | null = null;
  if (support) {
    const [notice] = await tx.insert(pickupNotifications).values({ orderId: order.id, contactId: support.id, contactName: support.name, contactEmail: support.email }).returning({ id: pickupNotifications.id });
    supportNotificationId = notice.id;
  }
  const [campus] = order.deliveryCampus ? await tx.select().from(campuses).where(eq(campuses.id, order.deliveryCampus)).for("share") : [];
  const destination = resolveOrderLocation(order, campus ?? null);
  await tx.update(orders).set({
    orderStatus: data.status, ...(support ? { pickupContactId: support.id, pickupContactName: support.name, pickupContactEmail: support.email } : {}), deliveryPickupHours: destination.deliveryPickupHours, deliveryLibraryLocation: destination.deliveryLibraryLocation, deliveryMapUrl: destination.deliveryMapUrl, courier: data.status === "DESPACHADO" && order.deliveryType === "delivery" ? data.courier : order.courier,
    ...(data.status === "DESPACHADO" ? { shippingTrackingCode: order.deliveryType === "delivery" ? data.trackingCode || null : null, shippingTrackingUrl: order.deliveryType === "delivery" ? data.trackingUrl || null : null, dispatchedAt: new Date() } : { deliveredAt: new Date() })
  }).where(eq(orders.id, order.id));
  const [notification] = await tx.insert(orderNotifications).values({ orderId: order.id, eventType: data.status, payload: { orderStatus: data.status, deliveryType: order.deliveryType, deliveryZone: order.deliveryZone ?? "", courier: data.status === "DESPACHADO" ? data.courier : order.courier ?? "", trackingCode: data.status === "DESPACHADO" ? data.trackingCode : order.shippingTrackingCode ?? "", trackingUrl: data.status === "DESPACHADO" ? data.trackingUrl : order.shippingTrackingUrl ?? "", address: destination.deliveryAddress, libraryLocation: destination.deliveryLibraryLocation ?? "", pickupHours: destination.deliveryPickupHours ?? "", pickupContactName: support?.name ?? order.pickupContactName ?? "", mapUrl: destination.deliveryMapUrl } }).returning({ id: orderNotifications.id });
  await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: data.status, detail: data.status === "ENTREGADO" ? "Entrega registrada. Gracias por tu pedido." : order.deliveryType === "recojo_campus" ? `Publicaciones listas para recoger en biblioteca.${support ? ` Apoyo para recojo: ${support.name}.` : ""}` : `Pedido enviado por ${data.courier}${data.trackingCode ? ` · Guía ${data.trackingCode}` : ""}.` });
  return { token: order.trackingToken, notificationId: notification.id, supportNotificationId };

}

export async function assignOrderRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof assignmentSchema>) {
  await assertOrderOperator(tx, actor);
  const [order] = await tx.select().from(orders).where(eq(orders.id, data.id)).for("update");
  if (!order) throw new OperationError("El pedido no existe.");
  if (["ENTREGADO", "CANCELADO"].includes(order.orderStatus)) throw new OperationError("Este pedido ya está cerrado.");
  if (data.operation === "claim" && order.assignedTo === actor.userId) return { token: order.trackingToken };
  checkVersion(order.updatedAt, data.version);
  if (data.operation === "claim") {
    if (order.assignedTo) throw new OperationError("Otro gestor ya tomó este pedido. Actualiza la página.");
    await tx.update(orders).set({ assignedTo: actor.userId, assignedName: actor.name, assignedAt: new Date() }).where(eq(orders.id, order.id));
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "ASIGNADO", detail: `${actor.name} está a cargo de tu pedido.` });
  } else {
    if (order.assignedTo !== actor.userId) throw new OperationError("Solo puedes liberar los pedidos que atiendes.");
    await tx.update(orders).set({ assignedTo: null, assignedName: null, assignedAt: null }).where(eq(orders.id, order.id));
    await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "LIBERADO", detail: "El pedido está disponible para un gestor del equipo." });
  }
  return { token: order.trackingToken };

}

export async function addInternalNoteRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof internalNoteSchema>) {
  await assertOrderOperator(tx, actor);
  const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, data.id)).for("share");
  if (!order) throw new OperationError("El pedido no existe.");
  await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "NOTA_INTERNA", detail: data.content });

}
