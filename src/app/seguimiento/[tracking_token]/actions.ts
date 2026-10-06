"use server";

import { reportServerError } from "@/lib/server-diagnostics";
import { after } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deliverOrderEmail } from "@/lib/orders/email";
import { OrderInputError, trackingTokenSchema } from "@/lib/orders/submission";
import { confirmReceiptSchema, receiptFileSchema, receiptMetadataSchema } from "@/lib/payments/validation";
import { confirmReceipt } from "@/lib/payments/confirm";
import { deliverOrderNotification, retryOrderNotifications } from "@/lib/orders/notifications";
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
    if (!(error instanceof OrderInputError)) reportServerError("receipt.upload.failed", error);
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos completar la carga. El archivo permanece seleccionado; reintenta sin retirarlo." };
  }
}

export async function retryConfirmationEmailAction(token: unknown) {
  const parsed = trackingTokenSchema.safeParse(token);
  if (!parsed.success) return { success: false, message: "Enlace no válido." };
  try {
    const confirmationSent = await deliverOrderEmail(parsed.data);
    const updatesSent = await retryOrderNotifications(parsed.data);
    const sent = confirmationSent || updatesSent;
    revalidatePath(`/seguimiento/${parsed.data}`);
    return { success: sent, message: sent ? "Correo de confirmación enviado." : "El correo ya se envió, está en proceso o debe esperar un minuto antes de reintentar. Si persiste, contacta al equipo." };
  } catch { return { success: false, message: "Tu pedido está guardado. No pudimos enviar el correo; inténtalo más tarde." }; }
}

export async function confirmReceiptAction(input: unknown): Promise<{ success: boolean; message: string }> {
  const parsed = confirmReceiptSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Selecciona un sello y un pedido válidos." };
  try {
    const notificationId = await confirmReceipt(parsed.data);
    after(async () => { try { await deliverOrderNotification(notificationId); } catch { /* Committed outbox can be retried. */ } });
    revalidatePath(`/seguimiento/${parsed.data.token}`);
    revalidatePath("/admin/pedidos", "layout");
    return { success: true, message: "Comprobantes enviados para revisión. Te avisaremos por correo." };
  } catch (error) {
    return { success: false, message: error instanceof OrderInputError ? error.message : "No se pudo confirmar. Tus archivos permanecen guardados; reintenta." };
  }
}
