"use server";

















import { withDatabase } from "@/db";
import { reportServerError } from "@/shared/logging/server-diagnostics";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { deleteBook, saveBook } from "@/modules/catalog/application/management";
import { deleteBookSchema, saveBookSchema } from "@/modules/catalog/domain/validation";
import { PickupEvidenceError, preparePickupEvidence } from "@/modules/orders/application/delivery-evidence";
import { deliverOrderEmail } from "@/modules/orders/application/email";
import { addInternalNote, assignOrder, dispatchOrder, reviewPayment } from "@/modules/orders/application/management";
import { deliverPickupSupportEmail } from "@/modules/orders/application/pickup-email";
import { assignmentSchema, dispatchSchema, internalNoteSchema, pickupImageSchema, pickupUploadSchema, reviewSchema, type ActionResult } from "@/modules/orders/domain/management";
import { OperationError } from "@/modules/orders/domain/operation-error";
import { deliverCajaEmail } from "@/modules/treasury/application/email";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

function code(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return;
  if ("code" in error && typeof error.code === "string") return error.code;
  if ("cause" in error) return code(error.cause);
}
function failure(error: unknown): ActionResult {
  return { success: false, message: error instanceof AccessError ? error.message : (error instanceof OperationError || error instanceof PickupEvidenceError) ? error.message : code(error) === "23505" ? "Ese código de inventario ya existe." : code(error) === "23503" ? "La publicación tiene pedidos asociados. Desactívala para conservar el historial." : "No se pudo guardar. Actualiza la página e intenta nuevamente." };
}

export async function reviewPaymentAction(input: unknown): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona un comprobante y una decisión válidos." };
  try {
    const requestHeaders = await headers();
    const outcome = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return reviewPayment(db, actor, parsed.data);
    });
    const mailResults = await Promise.all([outcome.cajaEvent ? deliverCajaEmail(outcome.cajaEvent.requestId, outcome.cajaEvent.notificationId) : true, outcome.notificationId ? deliverOrderEmail(outcome.token, outcome.notificationId) : true]);
    revalidatePath("/admin/pedidos", "layout");
    revalidatePath(`/seguimiento/${outcome.token}`);
    return { success: true, ...(!mailResults.every(Boolean) ? { mailWarning: "El cambio quedó guardado, pero no se pudo enviar el aviso por correo. No se reintentará automáticamente; consulta el detalle en la plataforma." } : {}), message: parsed.data.decision === "VERIFICADO" ? "Pago verificado." : "Pago rechazado. El comprador puede enviar un comprobante nuevo para este sello." };
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
  if (evidenceId && parsed.data.status !== "ENTREGADO") return { success: false, message: "La evidencia corresponde al cierre de la entrega." };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    const outcome = await withDatabase(async (db) => {
      return dispatchOrder(db, actor, parsed.data);
    });
    const [mailed, supportMailed] = await Promise.all([
      deliverOrderEmail(outcome.token, outcome.notificationId),
      outcome.supportNotificationId ? deliverPickupSupportEmail(outcome.supportNotificationId) : Promise.resolve(true),
    ]);
    const token = outcome.token;
    revalidatePath("/admin/pedidos", "layout"); revalidatePath(`/seguimiento/${token}`);
    return { success: true, ...(!mailed || !supportMailed ? { mailWarning: "El cambio quedó guardado, pero no se pudo enviar el aviso por correo. No se reintentará automáticamente; consulta el detalle en la plataforma." } : {}), message: parsed.data.status === "DESPACHADO" ? "Pedido despachado." : "Pedido entregado." };
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
      await saveBook(db, actor, parsed.data);
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
      await deleteBook(db, actor, parsed.data);
    });
    revalidatePath("/admin/inventario"); revalidatePath("/pedido");
    return { success: true, message: "Publicación eliminada." };
  } catch (error) { return failure(error); }
}


export async function assignOrderAction(input: unknown): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Actualiza el pedido antes de asignarlo." };
  try {
    const requestHeaders = await headers();
    const outcome = await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      return assignOrder(db, actor, parsed.data);
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
      await addInternalNote(db, actor, parsed.data);
    });
    revalidatePath(`/admin/pedidos/${parsed.data.id}`);
    return { success: true, message: "Nota interna guardada." };
  } catch (error) { return failure(error); }
}

export async function annulOrderAction(input: unknown): Promise<ActionResult> {
  const { annulPurchaseSchema } = await import("@/modules/orders/domain/cancellation-validation");
  const { cancelPurchase, CancellationError } = await import("@/modules/orders/application/cancellation");
  const parsed = annulPurchaseSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    const outcome = await cancelPurchase(parsed.data, actor);
    const mailResults = await Promise.all([outcome.notificationId ? deliverOrderEmail(outcome.token, outcome.notificationId) : true, ...outcome.cajaEvents.map((event) => deliverCajaEmail(event.requestId, event.notificationId))]);
    revalidatePath("/admin/pedidos", "layout"); revalidatePath("/admin/inventario"); revalidatePath("/tesoreria-recaudacion", "layout"); revalidatePath(`/seguimiento/${outcome.token}`);
    return { success: true, ...(!mailResults.every(Boolean) ? { mailWarning: "El cambio quedó guardado, pero no se pudo enviar el aviso por correo. No se reintentará automáticamente; consulta el detalle en la plataforma." } : {}), message: "Pedido anulado y stock restituido." };
  } catch (error) {
    if (!(error instanceof CancellationError || error instanceof AccessError)) reportServerError("order.annul.failed", error);
    return { success: false, message: error instanceof CancellationError || error instanceof AccessError ? error.message : "No pudimos anular el pedido. Reintenta." };
  }
}
