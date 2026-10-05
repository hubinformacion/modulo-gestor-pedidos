import type { Metadata } from "next";
import { asc, eq, inArray } from "drizzle-orm";
import { withDatabase } from "@/db";
import { books, campuses as campusTable } from "@/db/schema";
import { demoBooks } from "@/db/seeds/demo-books";
import { OrderWizard } from "@/components/order-wizard/wizard";
import { toPublicCampus } from "@/lib/campuses/catalog";
import { requirePageAccess, getAuthorizedSession } from "@/lib/access";
import { headers } from "next/headers";

export const metadata: Metadata = { title: "Vista previa del pedido" };

export default async function PreviewPage() {
  await requirePageAccess();
  const requestHeaders = await headers();
  const [catalog, campusRows] = await withDatabase(async (db) => {
    await getAuthorizedSession(db, requestHeaders);
    return Promise.all([db.select({
      id: books.id, inventoryCode: books.inventoryCode, title: books.title, author: books.author,
      publisherImprint: books.publisherImprint, standardPrice: books.standardPrice,
      communityPrice: books.communityPrice, stock: books.stock,
    }).from(books).where(inArray(books.inventoryCode, demoBooks.map((book) => book.inventoryCode))).orderBy(asc(books.inventoryCode)),
    db.select().from(campusTable).where(eq(campusTable.status, "ACTIVO")).orderBy(asc(campusTable.name))]);
  });
  return <OrderWizard catalog={catalog} campuses={campusRows.map(toPublicCampus)} preview />;
}
