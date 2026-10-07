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
  const schema = z.object({ cart: z.unknown(), buyer: z.unknown(), delivery: z.unknown(), couponCode: z.string().trim().toUpperCase().max(32).default("") });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Completa los datos del pedido." };
  try {
    const { getPublicCatalog } = await import("@/lib/orders/catalog");
    const { getActiveCampuses } = await import("@/lib/campuses/catalog");
    const { createOrderDraftSchema } = await import("@/lib/orders/validation");
    const [catalog, campuses] = await Promise.all([getPublicCatalog(), getActiveCampuses()]);
    const draft = createOrderDraftSchema(catalog, campuses).safeParse(parsed.data);
    if (!draft.success) return { success: false as const, message: draft.error.issues[0].message };
    const { pricingClock } = await import("@/lib/discounts/catalog");
    const at = await pricingClock();
    let coupon: { code: string; percent: number } | null = null;
    if (parsed.data.couponCode) {
      const { couponCodeSchema } = await import("@/lib/discounts/validation");
      const code = couponCodeSchema.safeParse(parsed.data.couponCode);
      if (!code.success) return { success: false as const, message: "Ingresa un código de cupón válido." };
      const { withReadDatabase } = await import("@/db");
      const { coupons } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const { assertCoupon } = await import("@/lib/discounts/coupons");
      const [row] = await withReadDatabase((db) => db.select().from(coupons).where(eq(coupons.code, code.data)));
      assertCoupon(row, draft.data.buyer.type, new Date(at));
      coupon = { code: row.code, percent: row.percent };
    }
    return { success: true as const, catalog, at, coupon };
  } catch (error) { return { success: false as const, message: error instanceof OrderInputError ? error.message : "No pudimos actualizar los precios. Reintenta." }; }
}
