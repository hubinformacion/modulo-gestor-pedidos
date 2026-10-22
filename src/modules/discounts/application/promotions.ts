import type { Database } from "@/db";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { deletePromotionRecord, savePromotionRecord } from "@/modules/discounts/data/promotions";
import type { deletePromotionSchema, promotionSchema } from "@/modules/discounts/domain/validation";
import "server-only";
import type { z } from "zod";

export async function savePromotion(db: Database, actor: AuthorizedActor, data: z.infer<typeof promotionSchema>) {
  return db.transaction((tx) => savePromotionRecord(tx, actor, data));
}
export async function deletePromotion(db: Database, actor: AuthorizedActor, data: z.infer<typeof deletePromotionSchema>) {
  return db.transaction((tx) => deletePromotionRecord(tx, actor, data));
}
