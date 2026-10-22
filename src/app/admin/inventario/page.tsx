import { WorkspacePageHeading } from "@/components/workspace/page-heading";
import type { Metadata } from "next";
import { inventoryRows } from "@/modules/catalog/application/queries";
import { requirePageAccess } from "@/modules/access/application/session";
import { InventoryPanel } from "@/components/catalog/inventory-panel";

export const metadata: Metadata = { title: "Inventario" };
export default async function InventoryPage() {
  await requirePageAccess();
  const rows = await inventoryRows();
  return <><WorkspacePageHeading eyebrow="Catálogo" title="Inventario" description="Gestiona publicaciones, precios y unidades disponibles de ambos sellos." /><InventoryPanel rows={rows} /></>;
}
