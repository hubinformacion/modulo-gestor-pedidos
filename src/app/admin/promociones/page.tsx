import { WorkspacePageHeading } from "@/components/workspace/page-heading";
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
  return <><WorkspacePageHeading eyebrow="Campañas" title="Promociones por temporada" description="Programa descuentos para cada público y elige las publicaciones participantes." /><PromotionsPanel at={at} catalog={catalog} rows={campaigns.map((row) => ({ ...row, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt.toISOString(), version: row.updatedAt.toISOString(), bookIds: links.filter((link) => link.promotionId === row.id).map((link) => link.bookId) }))} /></>;
}
