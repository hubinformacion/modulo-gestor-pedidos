import "server-only";
import { and, asc, eq, gt, inArray, lte } from "drizzle-orm";
import type { Database, ReadDatabase } from "@/db";
import { promotionBooks, promotions } from "@/db/schema";
import type { CatalogBook } from "@/lib/orders/types";
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function loadPromotionRules(db: Transaction | Database | ReadDatabase, at: Date, lock = false) {
  const query = db.select().from(promotions).where(and(eq(promotions.status, "ACTIVO"), lte(promotions.startsAt, at), gt(promotions.endsAt, at))).orderBy(asc(promotions.id));
  const rows = lock && "for" in query ? await query.for("share") : await query;
  const links = rows.length ? await db.select().from(promotionBooks).where(inArray(promotionBooks.promotionId, rows.map((row) => row.id))) : [];
  return rows.map((row) => ({ ...row, bookIds: row.scope === "all" ? null : links.filter((link) => link.promotionId === row.id).map((link) => link.bookId) }));
}
export function decoratePromotions(catalog: CatalogBook[], rules: Awaited<ReturnType<typeof loadPromotionRules>>): CatalogBook[] {
  return catalog.map((book) => ({ ...book, promotions: rules.filter((rule) => rule.bookIds === null || rule.bookIds.includes(book.id)).map((rule) => ({ id: rule.id, name: rule.name, communityPercent: rule.communityPercent, publicPercent: rule.publicPercent, startsAt: rule.startsAt.toISOString(), endsAt: rule.endsAt.toISOString() })) }));
}

export async function pricingClock() {
  const { withReadDatabase } = await import("@/db");
  const { sql } = await import("drizzle-orm");
  const [clock] = await withReadDatabase((db) => db.select({ at: sql<string>`(extract(epoch FROM current_timestamp) * 1000)::bigint::text` }));
  return Number(clock.at);
}
