import { OrderInputError } from "@/modules/orders/domain/submission";
import type { CustomerKind } from "@/modules/orders/domain/types";

type CouponAvailability = { status: "ACTIVO" | "INACTIVO"; audience: "all" | CustomerKind; startsAt: Date | null; endsAt: Date | null; maxUses: number | null; usedCount: number };
export function assertCoupon(coupon: CouponAvailability | undefined, customer: CustomerKind, at: Date) {
  if (!coupon || coupon.status !== "ACTIVO" || (coupon.audience !== "all" && coupon.audience !== customer) || (coupon.startsAt && coupon.startsAt > at) || (coupon.endsAt && coupon.endsAt <= at) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) || coupon.usedCount >= 2147483647) throw new OrderInputError("El cupón no está disponible para este pedido o ya alcanzó su límite de usos.");
}
