import type { Database } from "@/db";
import { books, promotionBooks, promotions } from "@/db/schema";
import { writeManagementAudit } from "@/modules/access/data/management-audit";
import { assertAuthorized } from "@/modules/access/data/transaction-access";
import type { AuthorizedActor } from "@/modules/access/domain/policy";
import { PromotionError } from "@/modules/discounts/domain/errors";
import { deletePromotionSchema, promotionSchema } from "@/modules/discounts/domain/validation";
import { asc, eq, inArray } from "drizzle-orm";
import "server-only";
import type { z } from "zod";

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export async function savePromotionRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof promotionSchema>) {
  await assertAuthorized(tx, actor);
  const { id, version, bookIds, ...fields } = data;
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
  await writeManagementAudit(tx, actor, "PROMOTION_SAVED", "promotion", saved.id, { created: !id, fields: Object.keys(values), selectedBookIds: ids, next: values });

}

export async function deletePromotionRecord(tx: Transaction, actor: AuthorizedActor, data: z.infer<typeof deletePromotionSchema>) {
  await assertAuthorized(tx, actor);
  const [current] = await tx.select().from(promotions).where(eq(promotions.id, data.id)).for("update");
  if (!current || current.updatedAt.toISOString() !== data.version) throw new PromotionError("La campaña cambió. Actualiza la página.");
  // Match by ID after the lock/version check; preserve PostgreSQL microseconds.
  const [deleted] = await tx.delete(promotions).where(eq(promotions.id, current.id)).returning();
  if (!deleted) throw new PromotionError("La campaña cambió. Actualiza la página.");
  await writeManagementAudit(tx, actor, "PROMOTION_DELETED", "promotion", current.id, { name: current.name });

}
