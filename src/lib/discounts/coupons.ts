import "server-only";
import type { coupons } from "@/db/schema";
import { OrderInputError } from "@/lib/orders/submission";
import type { CustomerKind } from "@/lib/orders/types";
export function assertCoupon(coupon: typeof coupons.$inferSelect | undefined, customer: CustomerKind, at: Date) {
  if (!coupon || coupon.status !== "ACTIVO" || (coupon.audience !== "all" && coupon.audience !== customer) || (coupon.startsAt && coupon.startsAt > at) || (coupon.endsAt && coupon.endsAt <= at) || (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) || coupon.usedCount >= 2147483647) throw new OrderInputError("El cupón no está disponible para este pedido o ya alcanzó su límite de usos.");
}
