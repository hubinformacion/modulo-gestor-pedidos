"use server";
import { headers } from "next/headers";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withDatabase } from "@/db";
import { getAuthorizedSession, getCajaSession } from "@/lib/access";
import { AccessError } from "@/lib/access-policy";
import { CajaError, finalizeSaleDocument, returnSaleDocument, uploadSaleDocument } from "@/lib/caja/service";
import { finalizeSaleSchema, pdfSchema, returnSaleSchema, uploadSaleSchema } from "@/lib/caja/validation";
import { deliverCajaEmail } from "@/lib/caja/email";
import { deliverOrderEmail } from "@/lib/orders/email";
import { reportServerError } from "@/lib/server-diagnostics";
function failure(error: unknown) { if (!(error instanceof AccessError || error instanceof CajaError)) reportServerError("caja.action.failed", error); return { success: false as const, message: error instanceof AccessError || error instanceof CajaError ? error.message : "No pudimos guardar el cambio. Reintenta." }; }
export async function uploadSaleAction(input: unknown) {
  const form = z.instanceof(FormData).safeParse(input);
  if (!form.success) return { success: false as const, message: "Selecciona un PDF válido." };
  const parsed = uploadSaleSchema.safeParse(Object.fromEntries(form.data));
  const file = pdfSchema.safeParse(form.data.get("file"));
  if (!parsed.success || !file.success) return { success: false as const, message: "Adjunta un PDF de hasta 3 MB." };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
    const document = await uploadSaleDocument(actor, parsed.data.id, parsed.data.uploadId, parsed.data.cycle, file.data);
    // No refresh during FilePond processing and no email before Finalizar.
    let href = `/tesoreria-recaudacion/${parsed.data.id}/archivos/${document.documentId}`;
    try {
      const { ensureCajaFileReader } = await import("@/lib/caja/drive-access");
      await ensureCajaFileReader(actor, parsed.data.id, document.driveFileId); href = document.driveViewUrl;
    } catch (error) { reportServerError("caja.upload.access.pending", error); }
    return { success: true as const, documentId: document.documentId, fileName: document.fileName, version: document.version, href };
  } catch (error) { return failure(error); }
}
export async function finalizeSaleAction(input: unknown) {
  const parsed = finalizeSaleSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Revisa la solicitud y su PDF." };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
    const outcome = await finalizeSaleDocument(actor, parsed.data);
    after(async () => { try { await Promise.allSettled([deliverCajaEmail(outcome.requestId), deliverOrderEmail(outcome.token)]); } catch (error) { reportServerError("caja.mail.pending", error); } });
    revalidatePath("/tesoreria-recaudacion", "layout"); revalidatePath("/admin/pedidos", "layout"); revalidatePath(`/seguimiento/${outcome.token}`);
    return { success: true as const, message: "Solicitud finalizada. Avisaremos al gestor y enviaremos los documentos al comprador cuando estén completos." };
  } catch (error) { return failure(error); }
}
export async function returnSaleAction(input: unknown) {
  const parsed = returnSaleSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getAuthorizedSession(db, requestHeaders));
    const outcome = await returnSaleDocument(actor, parsed.data);
    after(async () => { try { await deliverCajaEmail(outcome.requestId); } catch (error) { reportServerError("caja.return.mail", error); } });
    revalidatePath("/admin/pedidos", "layout"); revalidatePath("/tesoreria-recaudacion", "layout");
    return { success: true as const, message: "Solicitud devuelta a Tesorería Recaudación." };
  } catch (error) { return failure(error); }
}

export async function removeSaleDraftAction(input: unknown) {
  const { removeDraftSchema } = await import("@/lib/caja/validation");
  const { removeSaleDraft } = await import("@/lib/caja/service");
  const parsed = removeDraftSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Revisa el PDF que deseas retirar." };
  try {
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
    const version = await removeSaleDraft(actor, parsed.data);
    return { success: true as const, version };
  } catch (error) { return failure(error); }
}

export async function assignCajaAction(input: unknown) {
  const { cajaAssignmentSchema } = await import("@/lib/caja/validation");
  const parsed = cajaAssignmentSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Actualiza la solicitud antes de continuar." };
  try {
    const { changeCajaAssignment } = await import("@/lib/caja/service");
    const requestHeaders = await headers();
    const actor = await withDatabase((db) => getCajaSession(db, requestHeaders));
    await changeCajaAssignment(actor, parsed.data);
    revalidatePath("/tesoreria-recaudacion", "layout"); revalidatePath("/admin/pedidos", "layout");
    return { success: true as const, message: parsed.data.operation === "claim" ? "Atención tomada." : "Solicitud liberada." };
  } catch (error) { return failure(error); }
}
