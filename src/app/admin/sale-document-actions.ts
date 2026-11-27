"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { deliverOrderEmail } from "@/modules/orders/application/email";
import { finalizeSaleDocument, removeSaleDraft, reviseSaleDocuments, uploadSaleDocument } from "@/modules/orders/application/sale-documents";
import { OperationError } from "@/modules/orders/domain/operation-error";
import { finalizeSaleSchema, removeDraftSchema, reviseSaleSchema, saleFileSchema, uploadSaleSchema } from "@/modules/orders/domain/sale-documents";
import { reportServerError } from "@/shared/logging/server-diagnostics";

async function currentOperator() {
  const requestHeaders = await headers();
  return withDatabase((db) => getAuthorizedSession(db, requestHeaders));
}

function failure(error: unknown) {
  if (error instanceof AccessError || error instanceof OperationError) return { success: false as const, message: error.message };
  reportServerError("order.sale_documents.action", error);
  return { success: false as const, message: "No pudimos guardar el cambio. Actualiza el pedido y reintenta." };
}

export async function uploadSaleAction(input: unknown) {
  const form = z.instanceof(FormData).safeParse(input);
  if (!form.success) return { success: false as const, message: "Selecciona un archivo válido." };
  const parsed = uploadSaleSchema.safeParse(Object.fromEntries(form.data));
  const file = saleFileSchema.safeParse(form.data.get("file"));
  if (!parsed.success || !file.success) return { success: false as const, message: "Adjunta un archivo de hasta 3 MB." };
  try {
    const actor = await currentOperator();
    const document = await uploadSaleDocument(actor, parsed.data.id, parsed.data.uploadId, parsed.data.cycle, parsed.data.format, file.data);
    return { success: true as const, ...document };
  } catch (error) { return failure(error); }
}

export async function removeSaleDraftAction(input: unknown) {
  const parsed = removeDraftSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Revisa el archivo que deseas retirar." };
  try {
    const version = await removeSaleDraft(await currentOperator(), parsed.data);
    return { success: true as const, version };
  } catch (error) { return failure(error); }
}

export async function finalizeSaleAction(input: unknown) {
  const parsed = finalizeSaleSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Adjunta el PDF y el XML de la emisión." };
  try {
    const outcome = await finalizeSaleDocument(await currentOperator(), parsed.data);
    const mailed = !outcome.notificationId || await deliverOrderEmail(outcome.token, outcome.notificationId);
    revalidatePath(`/admin/pedidos/${outcome.orderId}`);
    revalidatePath(`/seguimiento/${outcome.token}`);
    return {
      success: true as const,
      message: "Los documentos confirmados están disponibles en Seguimiento.",
      ...(!mailed ? { mailWarning: "El comprador puede descargar los documentos en Seguimiento. El aviso por correo requiere atención manual." } : {}),
    };
  } catch (error) { return failure(error); }
}

export async function reviseSaleAction(input: unknown) {
  const parsed = reviseSaleSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
  try {
    const { orderId } = await reviseSaleDocuments(await currentOperator(), parsed.data);
    revalidatePath(`/admin/pedidos/${orderId}`);
    return { success: true as const, message: "La corrección quedó abierta." };
  } catch (error) { return failure(error); }
}
