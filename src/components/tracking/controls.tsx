"use client";
import dynamic from "next/dynamic";
import type { Imprint } from "@/lib/orders/types";
const ReceiptUploader = dynamic(() => import("./receipt-uploader"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de comprobantes…</p> });
export function ReceiptArea({ token, imprint, enabled }: { token: string; imprint: Imprint; enabled: boolean }) {
  return enabled ? <ReceiptUploader token={token} imprint={imprint} /> : <p className="text-xs leading-6 text-muted-foreground">La carga está temporalmente no disponible. Conserva tus comprobantes para adjuntarlos más tarde.</p>;
}
