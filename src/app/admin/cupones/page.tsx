import { pricingClock } from "@/lib/discounts/catalog";
import { desc } from "drizzle-orm";
import { coupons } from "@/db/schema";
import { withReadDatabase } from "@/db";
import { requirePageAccess } from "@/lib/access";
import { CouponsPanel } from "@/components/discounts/coupons-panel";
export const metadata = { title: "Cupones" };
export default async function CouponsPage() {
  await requirePageAccess();
  const rows = await withReadDatabase((db) => db.select().from(coupons).orderBy(desc(coupons.createdAt)));
  const at = await pricingClock();
  return <><h1 className="page-heading">Cupones de descuento</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Genera códigos, define su público y controla la cantidad de usos disponibles.</p><CouponsPanel at={at} rows={rows.map((row) => ({ ...row, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, version: row.updatedAt.toISOString() }))} /></>;
}
