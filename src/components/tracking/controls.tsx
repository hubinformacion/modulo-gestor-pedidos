"use client";

import dynamic from "next/dynamic";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import type { Imprint } from "@/lib/orders/types";
import { retryConfirmationEmailAction } from "@/app/seguimiento/[tracking_token]/actions";

export const ReceiptUploader = dynamic(() => import("./receipt-uploader"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de comprobantes…</p> });
export function TrackingControls({ token, retryEmail }: { token: string; retryEmail: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={() => router.refresh()}>Actualizar estado</Button>
    <Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); sileo.success({ title: "Enlace copiado" }); } catch { sileo.error({ title: "Copia el enlace desde la barra del navegador" }); } }}>Copiar enlace</Button>
    {retryEmail ? <Button variant="ghost" disabled={pending} onClick={() => startTransition(async () => {
      try { const result = await retryConfirmationEmailAction(token); (result.success ? sileo.success : sileo.error)({ title: result.message }); router.refresh(); }
      catch { sileo.error({ title: "No pudimos enviar el correo. Reintenta más tarde." }); }
    })}>{pending ? "Enviando…" : "Reintentar correo"}</Button> : null}
  </div>;
}
export function ReceiptArea({ token, writable, enabled }: { token: string; writable: Imprint[]; enabled: boolean }) {
  return enabled ? <ReceiptUploader token={token} writable={writable} /> : <p className="text-sm text-muted-foreground">La carga está temporalmente no disponible. Conserva tus comprobantes para enviarlos más tarde.</p>;
}
