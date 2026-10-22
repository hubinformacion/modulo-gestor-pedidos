"use server";







import { createOrder } from "@/modules/orders/application/create";
import { deliverOrderEmail } from "@/modules/orders/application/email";
import { reviewPricing } from "@/modules/orders/application/review-pricing";
import { OrderInputError, submissionSchema, type OrderCreationResult } from "@/modules/orders/domain/submission";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export async function createOrderAction(input: unknown): Promise<OrderCreationResult> {
  if (!submissionSchema.safeParse(input).success) return { success: false, message: "Revisa los datos del pedido y acepta la política." };
  try {
    const { trackingToken, created } = await createOrder(input, await headers());
    const mailed = !created || await deliverOrderEmail(trackingToken, null);
    revalidatePath("/pedido");
    return { success: true, trackingToken, ...(!mailed ? { mailWarning: "El pedido quedó registrado, pero no se pudo enviar el correo. Conserva tu enlace de seguimiento; no se reintentará el envío automáticamente." } : {}) };
  } catch (error) {
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos confirmar el pedido. Reintenta sin cambiar tus datos: el mismo intento evita duplicados." };
  }
}

export async function reviewPricingAction(input: unknown) {
  return reviewPricing(input);
}
