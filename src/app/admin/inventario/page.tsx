import { WorkspacePageHeading } from "@/components/workspace/page-heading";
import type { Metadata } from "next";
import { inventoryRows } from "@/lib/admin/data";
import { requirePageAccess } from "@/lib/access";
import { InventoryPanel } from "@/components/admin/inventory-panel";

export const metadata: Metadata = { title: "Inventario" };
export default async function InventoryPage() {
  await requirePageAccess();
  const rows = await inventoryRows();
  return <><WorkspacePageHeading eyebrow="Catálogo" title="Inventario" description="Gestiona publicaciones, precios y unidades disponibles de ambos sellos." /><InventoryPanel rows={rows} /></>;
}
