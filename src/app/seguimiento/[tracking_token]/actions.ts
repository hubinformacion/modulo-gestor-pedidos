"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deliverOrderEmail } from "@/lib/orders/email";
import { OrderInputError, trackingTokenSchema } from "@/lib/orders/submission";
import { receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { uploadReceipt } from "@/lib/payments/upload";

export async function uploadReceiptAction(input: unknown): Promise<{ success: true; receiptId: string } | { success: false; message: string }> {
  const form = z.instanceof(FormData).safeParse(input);
  if (!form.success) return { success: false, message: "La carga no tiene un formato válido." };
  const data = form.data;
  const metadata = receiptMetadataSchema.safeParse({ token: data.get("token"), uploadId: data.get("uploadId"), imprint: data.get("imprint") });
  const file = receiptFileSchema.safeParse(data.get("file"));
  if (!metadata.success || !file.success) return { success: false, message: "Selecciona un sello válido y un PDF, JPG o PNG de hasta 3 MB." };
  try {
    const receiptId = await uploadReceipt(metadata.data, file.data);
    revalidatePath(`/seguimiento/${metadata.data.token}`);
    return { success: true, receiptId };
  } catch (error) {
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos completar la carga. El archivo permanece seleccionado; reintenta sin retirarlo." };
  }
}

export async function retryConfirmationEmailAction(token: unknown) {
  const parsed = trackingTokenSchema.safeParse(token);
  if (!parsed.success) return { success: false, message: "Enlace no válido." };
  try {
    const sent = await deliverOrderEmail(parsed.data);
    revalidatePath(`/seguimiento/${parsed.data}`);
    return { success: sent, message: sent ? "Correo de confirmación enviado." : "El correo ya se envió, está en proceso o debe esperar un minuto antes de reintentar. Si persiste, contacta al equipo." };
  } catch { return { success: false, message: "Tu pedido está guardado. No pudimos enviar el correo; inténtalo más tarde." }; }
}
