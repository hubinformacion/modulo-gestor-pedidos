import type { Metadata } from "next";
import { inventoryRows } from "@/lib/admin/data";
import { requirePageAccess } from "@/lib/access";
import { InventoryPanel } from "@/components/admin/inventory-panel";

export const metadata: Metadata = { title: "Inventario" };
export default async function InventoryPage() {
  await requirePageAccess();
  const rows = await inventoryRows();
  return <><h1 className="page-heading">Inventario</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Gestiona publicaciones, precios y unidades disponibles de ambos sellos.</p><InventoryPanel rows={rows} /></>;
}
