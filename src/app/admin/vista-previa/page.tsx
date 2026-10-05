import type { Metadata } from "next";
import { asc, inArray } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books } from "@/db/schema";
import { demoBooks } from "@/db/seeds/demo-books";
import { OrderWizard } from "@/components/order-wizard/wizard";
import { campuses } from "@/config/fulfillment";
import { requirePageAccess, getAuthorizedSession } from "@/lib/access";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Vista previa del pedido" };

export default async function PreviewPage() {
  await requirePageAccess();
  const requestHeaders = await headers();
  const catalog = await withDatabase(async (db) => {
    await getAuthorizedSession(db, requestHeaders);
    return db.select({
      id: books.id, inventoryCode: books.inventoryCode, title: books.title, author: books.author,
      publisherImprint: books.publisherImprint, standardPrice: books.standardPrice,
      communityPrice: books.communityPrice, stock: books.stock,
    }).from(books).where(inArray(books.inventoryCode, demoBooks.map((book) => book.inventoryCode))).orderBy(asc(books.inventoryCode));
  });
  return <OrderWizard catalog={catalog} campuses={campuses} preview />;
}
