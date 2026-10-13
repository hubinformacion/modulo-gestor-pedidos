"use client";
import { useState, useTransition } from "react";
import { notifyAction } from "@/lib/ui/notifications";
import { Button } from "@/components/ui/button";
import { returnSaleAction } from "@/app/tesoreria-recaudacion/actions";
import { returnSaleSchema } from "@/lib/caja/validation";
export function ReturnSaleControls({ id, version }: { id: string; version: string }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  return <div className="mt-3" data-order-editing={open || pending ? "true" : undefined}>{open ? <form onSubmit={(event) => {
    event.preventDefault(); const parsed = returnSaleSchema.safeParse({ id, version, reason }); if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => { try { const result = await notifyAction(() => returnSaleAction(parsed.data), { loading: { title: "Solicitando corrección", description: "Registramos el motivo de devolución del documento." }, success: { title: "Corrección solicitada", description: "La solicitud abrió un nuevo ciclo de revisión para Tesorería Recaudación. El documento anterior se conserva." }, error: { title: "No se pudo devolver la solicitud", description: "Actualiza el pedido y reintenta conservando el motivo." } }); if (result.success) { setOpen(false); setReason(""); } else setError(result.message); } catch { setError("No se pudo devolver la solicitud."); } });
  }}><label htmlFor={`return-${id}`} className="mb-2 block text-xs font-medium">Motivo de la corrección</label><textarea id={`return-${id}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Indica qué dato o documento debe corregirse" minLength={5} maxLength={500} disabled={pending} className="min-h-24 w-full rounded-lg border border-input p-3 text-xs leading-6" /><div className="mt-2 flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={pending}>{pending ? "Guardando…" : "Solicitar corrección"}</Button><Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Cancelar</Button></div>{error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}</form> : <Button variant="outline" size="sm" onClick={() => setOpen(true)}>Devolver a Tesorería Recaudación</Button>}</div>;
}
