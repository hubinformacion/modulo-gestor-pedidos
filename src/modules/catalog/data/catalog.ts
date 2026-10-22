import { withReadDatabase } from "@/db";
import { books } from "@/db/schema";
import { decoratePromotions, loadPromotionRules } from "@/modules/discounts/data/catalog";
import type { CatalogBook } from "@/modules/orders/domain/types";
import { and, asc, eq, notLike } from "drizzle-orm";
import "server-only";

const catalogColumns = {
  id: books.id, inventoryCode: books.inventoryCode, title: books.title,
  author: books.author, publisherImprint: books.publisherImprint,
  standardPrice: books.standardPrice, communityPrice: books.communityPrice, stock: books.stock,
};

export async function getPublicCatalog(): Promise<CatalogBook[]> {
  return withReadDatabase(async (db) => {
    const [catalog, rules] = await Promise.all([
      db.select(catalogColumns).from(books).where(and(eq(books.status, "ACTIVO"), notLike(books.inventoryCode, "DEMO-%"))).orderBy(asc(books.publisherImprint), asc(books.title)),
      loadPromotionRules(db, new Date()),
    ]);
    return decoratePromotions(catalog, rules);
  });
}
