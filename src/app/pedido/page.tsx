import type { Metadata } from "next";
import { OrderWizard } from "@/components/order-wizard/wizard";
import { getActiveCampuses } from "@/lib/campuses/catalog";
import { paymentSetupReady } from "@/lib/payments/config";
import { getPublicCatalog } from "@/lib/orders/catalog";

export const metadata: Metadata = { title: "Nuevo pedido" };
export const runtime = "nodejs";
export const maxDuration = 180;
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const [catalog, campuses, ready] = await Promise.all([getPublicCatalog(), getActiveCampuses(), paymentSetupReady()]);
  return <main id="contenido" className="mx-auto max-w-6xl px-5 py-6 sm:px-10 sm:py-10"><OrderWizard catalog={catalog} campuses={campuses} submissionEnabled={ready} /></main>;
}
