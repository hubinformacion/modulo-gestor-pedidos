import { WorkspacePageHeading } from "@/components/workspace/page-heading";
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
  return <><WorkspacePageHeading eyebrow="Campañas" title="Cupones de descuento" description="Genera códigos, define su público y controla la cantidad de usos disponibles." /><CouponsPanel at={at} rows={rows.map((row) => ({ ...row, startsAt: row.startsAt?.toISOString() ?? null, endsAt: row.endsAt?.toISOString() ?? null, version: row.updatedAt.toISOString() }))} /></>;
}
