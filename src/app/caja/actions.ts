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
    return { success: true as const, ...document };
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
    revalidatePath("/caja", "layout"); revalidatePath("/admin/pedidos", "layout");
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
    revalidatePath("/admin/pedidos", "layout"); revalidatePath("/caja", "layout");
    return { success: true as const, message: "Solicitud devuelta a caja." };
  } catch (error) { return failure(error); }
}
