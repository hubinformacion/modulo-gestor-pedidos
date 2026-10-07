import { pricingClock } from "@/lib/discounts/catalog";
import { asc, desc, notLike } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { books, promotions, promotionBooks } from "@/db/schema";
import { requirePageAccess } from "@/lib/access";
import { PromotionsPanel } from "@/components/discounts/promotions-panel";
export const metadata = { title: "Promociones" };
export default async function PromotionsPage() {
  await requirePageAccess();
  const [campaigns, links, catalog] = await withReadDatabase((db) => Promise.all([db.select().from(promotions).orderBy(desc(promotions.createdAt)), db.select().from(promotionBooks), db.select({ id: books.id, title: books.title, code: books.inventoryCode, imprint: books.publisherImprint }).from(books).where(notLike(books.inventoryCode, "DEMO-%")).orderBy(asc(books.title))]));
  const at = await pricingClock();
  return <><h1 className="page-heading">Promociones por temporada</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Programa descuentos para cada público y elige las publicaciones participantes.</p><PromotionsPanel at={at} catalog={catalog} rows={campaigns.map((row) => ({ ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), version: row.updatedAt.toISOString(), bookIds: links.filter((link) => link.promotionId === row.id).map((link) => link.bookId) }))} /></>;
}
