"use server";

import { z } from "zod";
import { preparePickupEvidence, PickupEvidenceError } from "@/lib/delivery/evidence";
import { resolveOrderLocation } from "@/lib/orders/location";
import { after } from "next/server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { desc, eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, campuses, pickupEvidence, orderActivity, orderItems, orderNotifications, orders, paymentReceipts } from "@/db/schema";
import { deliverOrderEmail } from "@/lib/orders/email";
import { reportServerError } from "@/lib/server-diagnostics";
import { getAuthorizedSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { assertAuthorized } from "@/lib/transaction-access";
import { pickupImageSchema, pickupUploadSchema, internalNoteSchema, assignmentSchema, deleteBookSchema, dispatchSchema, reviewSchema, saveBookSchema, type ActionResult } from "@/lib/admin/validation";

function code(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return code(error.cause);
}
function failure(error: unknown): ActionResult {
  return { success: false, message: error instanceof AccessError ? error.message : (error instanceof OperationError || error instanceof PickupEvidenceError) ? error.message : code(error) === "23505" ? "Ese código de inventario ya existe." : code(error) === "23503" ? "La publicación tiene pedidos asociados. Desactívala para conservar el historial." : "No se pudo guardar. Actualiza la página e intenta nuevamente." };
}
class OperationError extends Error {}
function checkVersion(actual: Date, expected: string) {
  if (actual.toISOString() !== expected) throw new OperationError("Los datos cambiaron desde que abriste esta vista. Actualiza la página antes de continuar.");
}

export async function reviewPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona un comprobante y una decisión válidos." };
  try {
    const requestHeaders = await headers();
    const outcome = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const data = parsed.data;
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
        const notify = data.decision === "RECHAZADO" || complete;
        if (notify) await tx.insert(orderNotifications).values({ orderId: order.id, eventType: data.decision === "VERIFICADO" ? "PAGO_VERIFICADO" : "PAGO_RECHAZADO", publisherImprint: data.imprint, receiptId: data.receiptId, payload: { reason: data.reason, orderStatus: complete ? "EN_PREPARACION" : "PENDIENTE_PAGO", ...(complete && order.orderType === "mixto" ? { scope: "pedido" } : {}) } });
        await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: data.decision === "VERIFICADO" ? "PAGO_VERIFICADO" : "PAGO_RECHAZADO", detail: data.decision === "VERIFICADO" ? `Pago de ${data.imprint === "universidad" ? "Universidad" : "Instituto"} verificado.${complete ? " Iniciamos la distribución." : ""}` : `Comprobante de ${data.imprint === "universidad" ? "Universidad" : "Instituto"} rechazado: ${data.reason}` });
        return { token: order.trackingToken, notify };
      });
    });
    if (outcome.notify) after(async () => { try { await deliverOrderEmail(outcome.token); } catch { /* Preserve the event for retry. */ } });
    revalidatePath("/admin/pedidos", "layout");
    revalidatePath(`/seguimiento/${outcome.token}`);
    return { success: true, message: parsed.data.decision === "VERIFICADO" ? "Pago verificado." : "Pago rechazado. El comprador puede enviar un comprobante nuevo para este sello." };
  } catch (error) { return failure(error); }
}

export async function uploadPickupEvidenceAction(input: unknown): Promise<{ success: true; evidenceId: string } | { success: false; message: string }> {
  const form = z.instanceof(FormData).safeParse(input);
  if (!form.success) return { success: false, message: "Revisa la imagen." };
  const metadata = pickupUploadSchema.safeParse({ id: form.data.get("id"), version: form.data.get("version"), uploadId: form.data.get("uploadId") });
  const file = pickupImageSchema.safeParse(form.data.get("image"));
  if (!metadata.success || !file.success) return { success: false, message: file.success ? "Actualiza los datos del pedido." : file.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    const evidenceId = await preparePickupEvidence(actor, metadata.data.id, metadata.data.version, metadata.data.uploadId, file.data);
    // No route revalidation: keep the uploader mounted until processing completes.
    // Uploading evidence never changes the delivery state or sends an email.
    return { success: true, evidenceId };
  } catch (error) {
    if (!(error instanceof AccessError) && !(error instanceof PickupEvidenceError)) reportServerError("pickup.upload.failed", error);
    return { success: false, message: error instanceof AccessError || error instanceof PickupEvidenceError ? error.message : "No se pudo cargar. Conserva la imagen y reintenta." };
  }
}

export async function dispatchOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = dispatchSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Revisa los datos de entrega." };
  const evidenceId = parsed.data.evidenceId;
  if (evidenceId && parsed.data.status !== "ENTREGADO") return { success: false, message: "La evidencia corresponde al cierre del recojo." };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    const token = await withDatabase(async (db) => {
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const data = parsed.data;
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
          if (!proof || proof.orderId !== order.id || !proof.driveViewUrl || !proof.uploadedAt || data.status !== "ENTREGADO" || order.deliveryType !== "recojo_campus") throw new OperationError("La imagen aún no está lista. Reintenta sin retirarla.");
          await tx.update(pickupEvidence).set({ confirmedAt: new Date() }).where(eq(pickupEvidence.id, proof.id));
        }
        const [campus] = order.deliveryCampus ? await tx.select().from(campuses).where(eq(campuses.id, order.deliveryCampus)).for("share") : [];
        const destination = resolveOrderLocation(order, campus ?? null);
        await tx.update(orders).set({ orderStatus: data.status, deliveryLibraryLocation: destination.deliveryLibraryLocation, deliveryMapUrl: destination.deliveryMapUrl, courier: data.status === "DESPACHADO" && order.deliveryType === "delivery" ? data.courier : order.courier,
          ...(data.status === "DESPACHADO" ? { shippingTrackingCode: order.deliveryType === "delivery" ? data.trackingCode || null : null, shippingTrackingUrl: order.deliveryType === "delivery" ? data.trackingUrl || null : null, dispatchedAt: new Date() } : { deliveredAt: new Date() }) }).where(eq(orders.id, order.id));
        await tx.insert(orderNotifications).values({ orderId: order.id, eventType: data.status, payload: { orderStatus: data.status, deliveryType: order.deliveryType, deliveryZone: order.deliveryZone ?? "", courier: data.status === "DESPACHADO" ? data.courier : order.courier ?? "", trackingCode: data.status === "DESPACHADO" ? data.trackingCode : order.shippingTrackingCode ?? "", trackingUrl: data.status === "DESPACHADO" ? data.trackingUrl : order.shippingTrackingUrl ?? "", address: destination.deliveryAddress, libraryLocation: destination.deliveryLibraryLocation ?? "", mapUrl: destination.deliveryMapUrl } });
        await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: data.status, detail: data.status === "ENTREGADO" ? "Entrega registrada. Gracias por tu pedido." : order.deliveryType === "recojo_campus" ? "Publicaciones listas para recoger en biblioteca." : `Pedido enviado por ${data.courier}${data.trackingCode ? ` · Guía ${data.trackingCode}` : ""}.` });
        return order.trackingToken;
      });
    });
    scheduleOrderMail(token);
    revalidatePath("/admin/pedidos", "layout"); revalidatePath(`/seguimiento/${token}`);
    return { success: true, message: parsed.data.status === "DESPACHADO" ? "Pedido despachado." : "Pedido entregado." };
  } catch (error) {
    if (!(error instanceof AccessError) && !(error instanceof OperationError) && !(error instanceof PickupEvidenceError)) reportServerError("dispatch.failed", error);
    return failure(error);
  }
}

export async function saveBookAction(input: unknown): Promise<ActionResult> {
  const parsed = saveBookSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos de la publicación." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { id, version, book } = parsed.data;
        if (!id) { await tx.insert(books).values(book); return; }
        const [current] = await tx.select().from(books).where(eq(books.id, id)).for("update");
        if (!current) throw new OperationError("La publicación no existe.");
        checkVersion(current.updatedAt, version!);
        const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, id)).limit(1);
        if (used && current.publisherImprint !== book.publisherImprint) throw new OperationError("Una publicación con pedidos asociados no puede cambiar de sello.");
        await tx.update(books).set(book).where(eq(books.id, id));
      });
    });
    revalidatePath("/admin/inventario"); revalidatePath("/pedido");
    return { success: true, message: parsed.data.id ? "Publicación actualizada." : "Publicación creada." };
  } catch (error) { return failure(error); }
}

export async function deleteBookAction(input: unknown): Promise<ActionResult> {
  const parsed = deleteBookSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona una publicación válida." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [current] = await tx.select().from(books).where(eq(books.id, parsed.data.id)).for("update");
        if (!current) throw new OperationError("La publicación no existe.");
        checkVersion(current.updatedAt, parsed.data.version);
        const [used] = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.bookId, current.id)).limit(1);
        if (used) throw new OperationError("La publicación tiene pedidos asociados. Desactívala para conservar el historial.");
        await tx.delete(books).where(eq(books.id, current.id));
      });
    });
    revalidatePath("/admin/inventario"); revalidatePath("/pedido");
    return { success: true, message: "Publicación eliminada." };
  } catch (error) { return failure(error); }
}

function scheduleOrderMail(token: string) { after(async () => { try { await deliverOrderEmail(token); } catch (error) { reportServerError("order.mail.pending", error); } }); }

export async function assignOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Actualiza el pedido antes de asignarlo." };
  try {
    const requestHeaders = await headers();
    const outcome = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [order] = await tx.select().from(orders).where(eq(orders.id, parsed.data.id)).for("update");
        if (!order) throw new OperationError("El pedido no existe.");
        if (["ENTREGADO", "CANCELADO"].includes(order.orderStatus)) throw new OperationError("Este pedido ya está cerrado.");
        if (parsed.data.operation === "claim" && order.assignedTo === actor.userId) return { token: order.trackingToken };
        checkVersion(order.updatedAt, parsed.data.version);
        if (parsed.data.operation === "claim") {
          if (order.assignedTo) throw new OperationError("Otro gestor ya tomó este pedido. Actualiza la página.");
          await tx.update(orders).set({ assignedTo: actor.userId, assignedName: actor.name, assignedAt: new Date() }).where(eq(orders.id, order.id));
          await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "ASIGNADO", detail: `${actor.name} está a cargo de tu pedido.` });
        } else {
          if (order.assignedTo !== actor.userId) throw new OperationError("Solo puedes liberar los pedidos que atiendes.");
          await tx.update(orders).set({ assignedTo: null, assignedName: null, assignedAt: null }).where(eq(orders.id, order.id));
          await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "LIBERADO", detail: "El pedido está disponible para un gestor del equipo." });
        }
        return { token: order.trackingToken };
      });
    });
    revalidatePath("/admin/pedidos", "layout"); revalidatePath(`/seguimiento/${outcome.token}`);
    return { success: true, message: parsed.data.operation === "claim" ? "El pedido quedó asignado." : "Pedido disponible para otro gestor." };
  } catch (error) { return failure(error); }
}

export async function addInternalNoteAction(input: unknown): Promise<ActionResult> {
  const parsed = internalNoteSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [order] = await tx.select({ id: orders.id }).from(orders).where(eq(orders.id, parsed.data.id)).for("share");
        if (!order) throw new OperationError("El pedido no existe.");
        await tx.insert(orderActivity).values({ orderId: order.id, actorUserId: actor.userId, actorName: actor.name, eventType: "NOTA_INTERNA", detail: parsed.data.content });
      });
    });
    revalidatePath(`/admin/pedidos/${parsed.data.id}`);
    return { success: true, message: "Nota interna guardada." };
  } catch (error) { return failure(error); }
}
