import type { Metadata } from "next";
import { OrderWizard } from "@/components/order-wizard/wizard";
import { getActiveCampuses } from "@/lib/campuses/catalog";
import { getPublicCatalog } from "@/lib/orders/catalog";

export const metadata: Metadata = { title: "Nuevo pedido" };
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const [catalog, campuses] = await Promise.all([getPublicCatalog(), getActiveCampuses()]);
  return <main id="contenido" className="mx-auto max-w-6xl px-5 py-6 sm:px-10 sm:py-10"><OrderWizard catalog={catalog} campuses={campuses} /></main>;
}
