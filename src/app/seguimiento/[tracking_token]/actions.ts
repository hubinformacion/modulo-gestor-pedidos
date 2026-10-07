"use server";

import { reportServerError } from "@/lib/server-diagnostics";
import { after } from "next/server";
import { z } from "zod";
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
    const result = await uploadReceipt(metadata.data, file.data);
    if (result.notify) after(async () => { try { await deliverOrderEmail(metadata.data.token); } catch (error) { reportServerError("receipt.mail.pending", error); } });
    // The client refreshes after its entire FilePond batch succeeds. Revalidating
    // here can unmount the uploader after the first file and lose queued files.
    // Both order screens read dynamically; admin sees committed receipts on its next navigation/focus refresh.
    return { success: true, receiptId: result.id };
  } catch (error) {
    if (!(error instanceof OrderInputError)) reportServerError("receipt.upload.failed", error);
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos completar la carga. El archivo permanece seleccionado; reintenta sin retirarlo." };
  }
}

export async function cancelOrderAction(input: unknown) {
  const { cancelPurchaseSchema } = await import("@/lib/orders/cancellation-validation");
  const parsed = cancelPurchaseSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Revisa el pedido y el motivo de cancelación." };
  const { cancelPurchase, CancellationError } = await import("@/lib/orders/cancellation");
  try {
    const outcome = await cancelPurchase(parsed.data);
    const { revalidatePath } = await import("next/cache");
    after(async () => { try { await deliverOrderEmail(outcome.token); } catch (error) { reportServerError("cancel.mail.pending", error); } });
    revalidatePath(`/seguimiento/${outcome.token}`); revalidatePath("/admin/pedidos", "layout"); revalidatePath("/admin/inventario");
    return { success: true, message: "Pedido cancelado." };
  } catch (error) {
    if (!(error instanceof CancellationError)) reportServerError("order.cancel.failed", error);
    return { success: false, message: error instanceof CancellationError ? error.message : "No pudimos cancelar el pedido. Reintenta." };
  }
}
