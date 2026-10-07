import "server-only";
import { decoratePromotions, loadPromotionRules } from "@/lib/discounts/catalog";
import { and, asc, eq, notLike } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { books } from "@/db/schema";
import type { CatalogBook } from "./types";

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
