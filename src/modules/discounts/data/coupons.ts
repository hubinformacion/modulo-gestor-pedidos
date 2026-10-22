import type { Database } from "@/db";
import { books, couponRedemptions, coupons } from "@/db/schema";
import { writeManagementAudit } from "@/modules/access/data/management-audit";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { CouponError } from "@/modules/discounts/domain/errors";
import { couponSchema, deleteCouponSchema } from "@/modules/discounts/domain/validation";
import { eq, inArray } from "drizzle-orm";
import "server-only";
import type { z } from "zod";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function saveCouponRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof couponSchema>) {
  await assertAuthorized(tx, actor);
  const { id, version, ...fields } = data;
  fields.bookIds = [...new Set(fields.bookIds)];
  if (fields.scope === "selected") {
    const selected = await tx.select({ id: books.id }).from(books).where(inArray(books.id, fields.bookIds));
    if (selected.length !== fields.bookIds.length) throw new CouponError("Alguna publicación ya no existe. Revisa la selección.");
  } else fields.bookIds = [];
  if (id) {
    const [current] = await tx.select().from(coupons).where(eq(coupons.id, id)).for("update");
    if (!current || current.updatedAt.toISOString() !== version) throw new CouponError("El cupón cambió o fue utilizado. Actualiza la página.");
    if (fields.maxUses !== null && fields.maxUses < current.usedCount) throw new CouponError("El límite no puede ser menor que los usos actuales.");
    const [used] = await tx.select({ id: couponRedemptions.orderId }).from(couponRedemptions).where(eq(couponRedemptions.couponId, id)).limit(1);
    if (used && current.code !== fields.code) throw new CouponError("Un cupón con pedidos conserva su código. Crea otro si necesitas cambiarlo.");
  }
  const values = { ...fields, startsAt: fields.startsAt ? new Date(fields.startsAt) : null, endsAt: fields.endsAt ? new Date(fields.endsAt) : null };
  const [saved] = id ? await tx.update(coupons).set(values).where(eq(coupons.id, id)).returning({ id: coupons.id }) : await tx.insert(coupons).values(values).returning({ id: coupons.id });
  await writeManagementAudit(tx, actor, "COUPON_SAVED", "coupon", saved.id, { created: !id, fields: Object.keys(values), next: values });

}

export async function deleteCouponRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof deleteCouponSchema>) {
  await assertAuthorized(tx, actor);
  const [current] = await tx.select().from(coupons).where(eq(coupons.id, data.id)).for("update");
  if (!current || current.updatedAt.toISOString() !== data.version) throw new CouponError("El cupón cambió. Actualiza la página.");
  const [used] = await tx.select({ id: couponRedemptions.orderId }).from(couponRedemptions).where(eq(couponRedemptions.couponId, current.id)).limit(1);
  if (used) throw new CouponError("El cupón tiene pedidos asociados. Desactívalo para conservar su historial.");
  // The locked row was checked above. Dates exposed to JS omit PG microseconds.
  const [deleted] = await tx.delete(coupons).where(eq(coupons.id, current.id)).returning();
  if (!deleted) throw new CouponError("El cupón cambió. Actualiza la página.");
  await writeManagementAudit(tx, actor, "COUPON_DELETED", "coupon", current.id);

}
