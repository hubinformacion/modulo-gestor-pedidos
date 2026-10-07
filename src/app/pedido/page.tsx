import { pricingClock } from "@/lib/discounts/catalog";
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
  const [catalog, campuses, ready, at] = await Promise.all([getPublicCatalog(), getActiveCampuses(), paymentSetupReady(), pricingClock()]);
  return <main id="contenido" className="public-order-surface mx-auto w-full max-w-6xl px-5 py-6 sm:px-10 sm:py-10"><header className="mb-7 border-b border-border pb-6 sm:mb-9 sm:pb-8"><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-primary">Publicaciones</p><h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Pedido de publicaciones</h1><p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">Selecciona tus títulos y coordina la entrega o el recojo en biblioteca.</p></header><OrderWizard initialPricingAt={at} catalog={catalog} campuses={campuses} submissionEnabled={ready} /></main>;
}
