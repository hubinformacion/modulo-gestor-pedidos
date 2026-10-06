import Link from "next/link";
import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { requireCajaAccess } from "@/lib/access";
import { LogoutButton } from "@/components/logout-button";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;
export const metadata: Metadata = { title: "Caja", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function CajaLayout({ children }: { children: React.ReactNode }) {
  const actor = await requireCajaAccess();
  return <div className="min-h-[24rem]"><header className="border-b border-border"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4 sm:px-10"><Link href="/caja" className="flex items-center gap-2 text-sm font-semibold"><ReceiptText className="size-5 text-primary" />Caja · Documentos de venta</Link><div className="flex flex-wrap items-center gap-3"><ImprintBadge imprint={actor.publisherImprint!} /><span title={actor.email} className="max-w-44 truncate text-xs text-muted-foreground">{actor.email}</span><LogoutButton /></div></div></header><main id="contenido" className="mx-auto max-w-6xl px-6 py-8 sm:px-10">{children}</main></div>;
}
