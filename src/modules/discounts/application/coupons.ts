import type { Database } from "@/db";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { deleteCouponRecord, saveCouponRecord } from "@/modules/discounts/data/coupons";
import type { couponSchema, deleteCouponSchema } from "@/modules/discounts/domain/validation";
import "server-only";
import type { z } from "zod";

export async function saveCoupon(db: Database, actor: AuthorizedActor, data: z.infer<typeof couponSchema>) {
  return db.transaction((tx) => saveCouponRecord(tx, actor, data));
}
export async function deleteCoupon(db: Database, actor: AuthorizedActor, data: z.infer<typeof deleteCouponSchema>) {
  return db.transaction((tx) => deleteCouponRecord(tx, actor, data));
}
