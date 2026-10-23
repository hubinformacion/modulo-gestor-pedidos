"use server";










import { withDatabase } from "@/db";
import { reportServerError, safeErrorDetails } from "@/shared/logging/server-diagnostics";
import { getAuthorizedSession } from "@/modules/access/application/session";
import { AccessError } from "@/modules/access/domain/policy";
import { deleteCoupon, saveCoupon } from "@/modules/discounts/application/coupons";
import { CouponError } from "@/modules/discounts/domain/errors";
import { couponSchema, deleteCouponSchema } from "@/modules/discounts/domain/validation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

function failure(error: unknown) { if (!(error instanceof CouponError || error instanceof AccessError)) reportServerError("coupon.change.failed", error); return { success: false, message: error instanceof CouponError || error instanceof AccessError ? error.message : safeErrorDetails(error).code === "23505" ? "Ese código ya existe." : safeErrorDetails(error).code === "23503" ? "El cupón tiene pedidos asociados. Desactívalo para conservar su historial." : "No pudimos guardar el cupón." }; }
export async function saveCouponAction(input: unknown) {
  const parsed = couponSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await saveCoupon(db, actor, parsed.data);
    });
    revalidatePath("/admin/cupones"); return { success: true, message: "Cupón guardado." };
  } catch (error) { return failure(error); }
}
export async function deleteCouponAction(input: unknown) {
  const parsed = deleteCouponSchema.safeParse(input); if (!parsed.success) return { success: false, message: "Actualiza el cupón." };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await deleteCoupon(db, actor, parsed.data);
    });
    revalidatePath("/admin/cupones"); return { success: true, message: "Cupón eliminado." };
  } catch (error) { return failure(error); }
}
