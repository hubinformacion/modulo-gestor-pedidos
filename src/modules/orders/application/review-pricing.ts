import { OrderInputError } from "@/modules/orders/domain/submission";
import "server-only";

export async function reviewPricing(input: unknown) {
  const { z } = await import("zod");
  const schema = z.object({ cart: z.unknown(), buyer: z.unknown(), delivery: z.unknown(), couponCode: z.string().trim().toUpperCase().max(32).default("") });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false as const, message: "Completa los datos del pedido." };
  try {
    const { getPublicCatalog } = await import("@/modules/catalog/data/catalog");
    const { getActiveCampuses } = await import("@/modules/settings/data/campuses-catalog");
    const { createOrderDraftSchema } = await import("@/modules/orders/domain/validation");
    const { getDeliveryRates } = await import("@/modules/settings/data/delivery-rates");
    const [catalog, campuses, rates] = await Promise.all([getPublicCatalog(), getActiveCampuses(), getDeliveryRates()]);
    const draft = createOrderDraftSchema(catalog, campuses, false).safeParse(parsed.data);
    if (!draft.success) return { success: false as const, message: draft.error.issues[0].message };
    const { pricingClock } = await import("@/modules/discounts/data/catalog");
    const at = await pricingClock();
    let coupon: import("@/modules/orders/domain/types").CouponOffer | null = null;
    if (parsed.data.couponCode) {
      const { couponCodeSchema } = await import("@/modules/discounts/domain/validation");
      const code = couponCodeSchema.safeParse(parsed.data.couponCode);
      if (!code.success) return { success: false as const, message: "Ingresa un código de cupón válido." };
      const { withReadDatabase } = await import("@/db");
      const { coupons } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const { assertCoupon } = await import("@/modules/discounts/domain/coupons");
      const [row] = await withReadDatabase((db) => db.select().from(coupons).where(eq(coupons.code, code.data)));
      assertCoupon(row, draft.data.buyer.type, new Date(at));
      coupon = { code: row.code, percent: row.percent, scope: row.scope, bookIds: row.bookIds };
    }
    const { calculateQuote } = await import("@/modules/orders/domain/pricing");
    if (calculateQuote(catalog, draft.data.cart, draft.data.buyer.type, draft.data.delivery, at, rates, coupon).shippingUnavailable) return { success: false as const, message: "El delivery a esta zona no está disponible. Selecciona recojo u otra dirección válida." };
    return { success: true as const, catalog, at, coupon, rates };
  } catch (error) { return { success: false as const, message: error instanceof OrderInputError ? error.message : "No pudimos actualizar los precios. Reintenta." }; }
}
