"use server";

import { reportServerError } from "@/lib/server-diagnostics";
import { after } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { deliverOrderEmail } from "@/lib/orders/email";
import { OrderInputError } from "@/lib/orders/submission";
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
    after(async () => { try { await deliverOrderEmail(metadata.data.token); } catch (error) { reportServerError("receipt.mail.pending", error); } });
    revalidatePath("/admin/pedidos", "layout");
    revalidatePath(`/seguimiento/${metadata.data.token}`);
    return { success: true, receiptId };
  } catch (error) {
    if (!(error instanceof OrderInputError)) reportServerError("receipt.upload.failed", error);
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos completar la carga. El archivo permanece seleccionado; reintenta sin retirarlo." };
  }
}
