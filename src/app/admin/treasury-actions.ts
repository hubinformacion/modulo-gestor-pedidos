"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { withDatabase } from "@/db";
import { getAuthorizedSession } from "@/lib/access";
import { uploadSupportingFile } from "@/lib/treasury/supporting-files";
import { receiptFileSchema } from "@/lib/payments/validation";
import { CajaError } from "@/lib/caja/service";
import { AccessError } from "@/lib/access-policy";
import { reportServerError } from "@/lib/server-diagnostics";
export async function uploadTreasurySupportingAction(input: unknown) {
  const form = z.instanceof(FormData).safeParse(input); if (!form.success) return { success: false as const, message: "Carga inválida." };
  const parsed = z.object({ id: z.uuid(), uploadId: z.uuid() }).safeParse(Object.fromEntries(form.data)); const file = receiptFileSchema.safeParse(form.data.get("file"));
  if (!parsed.success || !file.success) return { success: false as const, message: "Adjunta un PDF, JPG o PNG de hasta 3 MB." };
  try {
    const h = await headers(); const actor = await withDatabase((db) => getAuthorizedSession(db, h)); const id = await uploadSupportingFile(actor, parsed.data.id, parsed.data.uploadId, file.data);
    return { success: true as const, id };
  } catch (error) { if (!(error instanceof CajaError || error instanceof AccessError)) reportServerError("treasury.support.upload", error); return { success: false as const, message: error instanceof CajaError || error instanceof AccessError ? error.message : "No se pudo cargar. Conserva el archivo y reintenta." }; }
}
