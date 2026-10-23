"use server";










import { withDatabase } from "@/db";
import { reportServerError, safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { deletePromotion, savePromotion } from "@/modules/discounts/application/promotions";
import { PromotionError } from "@/modules/discounts/domain/errors";
import { deletePromotionSchema, promotionSchema } from "@/modules/discounts/domain/validation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function failure(error: unknown) { if (!(error instanceof PromotionError || error instanceof AccessError)) reportServerError("promotion.change.failed", error); return { success: false, message: error instanceof PromotionError || error instanceof AccessError ? error.message : safeErrorDetails(error).code === "23503" ? "Esta campaña tiene pedidos asociados. Desactívala para conservar el historial." : "No pudimos guardar la campaña. Reintenta." }; }
export async function savePromotionAction(input: unknown) {
  const parsed = promotionSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await savePromotion(db, actor, parsed.data);
    });
    revalidatePath("/admin/promociones"); revalidatePath("/pedido");
    return { success: true, message: "Campaña guardada." };
  } catch (error) { return failure(error); }
}
export async function deletePromotionAction(input: unknown) {
  const parsed = deletePromotionSchema.safeParse(input); if (!parsed.success) return { success: false, message: "Actualiza la campaña." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await deletePromotion(db, actor, parsed.data);
    });
    revalidatePath("/admin/promociones"); revalidatePath("/pedido"); return { success: true, message: "Campaña eliminada." };
  } catch (error) { return failure(error); }
}
