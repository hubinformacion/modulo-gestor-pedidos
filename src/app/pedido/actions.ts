"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createOrder } from "@/lib/orders/create";
import { deliverOrderEmail } from "@/lib/orders/email";
import { OrderInputError, submissionSchema, type OrderCreationResult } from "@/lib/orders/submission";

export async function createOrderAction(input: unknown): Promise<OrderCreationResult> {
  if (!submissionSchema.safeParse(input).success) return { success: false, message: "Revisa los datos del pedido y acepta la política." };
  try {
    const trackingToken = await createOrder(input);
    after(async () => { try { await deliverOrderEmail(trackingToken); } catch { /* Durable outbox remains available for retry. */ } });
    revalidatePath("/pedido");
    return { success: true, trackingToken };
  } catch (error) {
    return { success: false, message: error instanceof OrderInputError ? error.message : "No pudimos confirmar el pedido. Reintenta sin cambiar tus datos: el mismo intento evita duplicados." };
  }
}
