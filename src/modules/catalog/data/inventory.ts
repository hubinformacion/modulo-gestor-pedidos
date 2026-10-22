import { withReadDatabase } from "@/db";
import { books } from "@/db/schema";
import { asc } from "drizzle-orm";
import "server-only";

export async function inventoryRowsRecord() {
  return withReadDatabase(async (db) => {
    const rows = await db.select().from(books).orderBy(asc(books.title), asc(books.id));
    return rows.map((row) => ({ id: row.id, inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status, version: row.updatedAt.toISOString() }));
  });
}
