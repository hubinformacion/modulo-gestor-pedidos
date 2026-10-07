"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { asc, eq, inArray } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, promotions, promotionBooks } from "@/db/schema";
import { getAuthorizedSession } from "@/lib/access";
import { assertAuthorized } from "@/lib/transaction-access";
import { AccessError } from "@/lib/access-policy";
import { promotionSchema, deletePromotionSchema } from "@/lib/discounts/validation";
import { reportServerError, safeErrorDetails } from "@/lib/server-diagnostics";
class PromotionError extends Error {}
function failure(error: unknown) { if (!(error instanceof PromotionError || error instanceof AccessError)) reportServerError("promotion.change.failed", error); return { success: false, message: error instanceof PromotionError || error instanceof AccessError ? error.message : safeErrorDetails(error).code === "23503" ? "Esta campaña tiene pedidos asociados. Desactívala para conservar el historial." : "No pudimos guardar la campaña. Reintenta." }; }
export async function savePromotionAction(input: unknown) {
  const parsed = promotionSchema.safeParse(input); if (!parsed.success) return { success: false, message: parsed.error.issues[0].message };
  try {
    const requestHeaders = await headers();
    await withDatabase(async (db) => {
      const actor = await getAuthorizedSession(db, requestHeaders);
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const { id, version, bookIds, ...fields } = parsed.data;
        if (id) {
          const [current] = await tx.select().from(promotions).where(eq(promotions.id, id)).for("update");
          if (!current || current.updatedAt.toISOString() !== version) throw new PromotionError("La campaña cambió. Actualiza la página.");
        }
        const ids = fields.scope === "all" ? [] : [...new Set(bookIds)];
        const selected = ids.length ? await tx.select({ id: books.id }).from(books).where(inArray(books.id, ids)).orderBy(asc(books.id)).for("share") : [];
        if (selected.length !== ids.length) throw new PromotionError("Algunas publicaciones ya no están disponibles.");
        const values = { ...fields, startsAt: new Date(fields.startsAt), endsAt: new Date(fields.endsAt) };
        const [saved] = id ? await tx.update(promotions).set(values).where(eq(promotions.id, id)).returning() : await tx.insert(promotions).values(values).returning();
        await tx.delete(promotionBooks).where(eq(promotionBooks.promotionId, saved.id));
        if (ids.length) await tx.insert(promotionBooks).values(ids.map((bookId) => ({ promotionId: saved.id, bookId })));
      });
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
      await db.transaction(async (tx) => {
        await assertAuthorized(tx, actor);
        const [current] = await tx.select().from(promotions).where(eq(promotions.id, parsed.data.id)).for("update");
        if (!current || current.updatedAt.toISOString() !== parsed.data.version) throw new PromotionError("La campaña cambió. Actualiza la página.");
        // Match by ID after the lock/version check; preserve PostgreSQL microseconds.
        const [deleted] = await tx.delete(promotions).where(eq(promotions.id, current.id)).returning();
        if (!deleted) throw new PromotionError("La campaña cambió. Actualiza la página.");
      });
    });
    revalidatePath("/admin/promociones"); revalidatePath("/pedido"); return { success: true, message: "Campaña eliminada." };
  } catch (error) { return failure(error); }
}
