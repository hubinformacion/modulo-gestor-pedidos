import "server-only";
import { and, asc, eq, notLike } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books } from "@/db/schema";
import type { CatalogBook } from "./types";

const catalogColumns = {
  id: books.id, inventoryCode: books.inventoryCode, title: books.title,
  author: books.author, publisherImprint: books.publisherImprint,
  standardPrice: books.standardPrice, communityPrice: books.communityPrice, stock: books.stock,
};

export async function getPublicCatalog(): Promise<CatalogBook[]> {
  return withDatabase((db) => db.select(catalogColumns).from(books)
    .where(and(eq(books.status, "ACTIVO"), notLike(books.inventoryCode, "DEMO-%")))
    .orderBy(asc(books.publisherImprint), asc(books.title)));
}
