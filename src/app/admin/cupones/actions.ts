"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { withDatabase } from "@/db";
import { coupons, couponRedemptions } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { assertAuthorized } from "@/lib/transaction-access";
import { AccessError } from "@/lib/access-policy";
import { couponSchema, deleteCouponSchema } from "@/lib/discounts/validation";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";
class CouponError extends Error {}
function failure(error: unknown) { if (!(error instanceof CouponError || error instanceof AccessError)) reportServerError("coupon.change.failed", error); return { success: false, message: error instanceof CouponError || error instanceof AccessError ? error.message : safeErrorDetails(error).code === "23505" ? "Ese código ya existe." : safeErrorDetails(error).code === "23503" ? "El cupón tiene pedidos asociados. Desactívalo para conservar su historial." : "No pudimos guardar el cupón." }; }
export async function saveCouponAction(input: unknown) {
  const parsed = couponSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { id, version, ...fields } = parsed.data;
        if (id) {
          const [current] = await tx.select().from(coupons).where(eq(coupons.id, id)).for("update");
          if (!current || current.updatedAt.toISOString() !== version) throw new CouponError("El cupón cambió o fue utilizado. Actualiza la página.");
          if (fields.maxUses !== null && fields.maxUses < current.usedCount) throw new CouponError("El límite no puede ser menor que los usos actuales.");
          const [used] = await tx.select({ id: couponRedemptions.orderId }).from(couponRedemptions).where(eq(couponRedemptions.couponId, id)).limit(1);
          if (used && current.code !== fields.code) throw new CouponError("Un cupón con pedidos conserva su código. Crea otro si necesitas cambiarlo.");
        }
        const values = { ...fields, startsAt: fields.startsAt ? new Date(fields.startsAt) : null, endsAt: fields.endsAt ? new Date(fields.endsAt) : null };
        if (id) await tx.update(coupons).set(values).where(eq(coupons.id, id)); else await tx.insert(coupons).values(values);
      });
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
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [current] = await tx.select().from(coupons).where(eq(coupons.id, parsed.data.id)).for("update");
        if (!current || current.updatedAt.toISOString() !== parsed.data.version) throw new CouponError("El cupón cambió. Actualiza la página.");
        const [used] = await tx.select({ id: couponRedemptions.orderId }).from(couponRedemptions).where(eq(couponRedemptions.couponId, current.id)).limit(1);
        if (used) throw new CouponError("El cupón tiene pedidos asociados. Desactívalo para conservar su historial.");
        // The locked row was checked above. Dates exposed to JS omit PG microseconds.
        const [deleted] = await tx.delete(coupons).where(eq(coupons.id, current.id)).returning();
        if (!deleted) throw new CouponError("El cupón cambió. Actualiza la página.");
      });
    });
    revalidatePath("/admin/cupones"); return { success: true, message: "Cupón eliminado." };
  } catch (error) { return failure(error); }
}
