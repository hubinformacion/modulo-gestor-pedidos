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

export async function reviewPricingAction(input: unknown) {
  const { z } = await import("zod");
  const schema = z.object({ cart: z.unknown(), buyer: z.unknown(), delivery: z.unknown() });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Completa los datos del pedido." };
  try {
    const { getPublicCatalog } = await import("@/lib/orders/catalog");
    const { getActiveCampuses } = await import("@/lib/campuses/catalog");
    const { createOrderDraftSchema } = await import("@/lib/orders/validation");
    const [catalog, campuses] = await Promise.all([getPublicCatalog(), getActiveCampuses()]);
    const draft = createOrderDraftSchema(catalog, campuses).safeParse(parsed.data);
    if (!draft.success) return { success: false as const, message: draft.error.issues[0].message };
    return { success: true as const, catalog, at: Date.now() };
  } catch { return { success: false as const, message: "No pudimos actualizar los precios. Reintenta." }; }
}
