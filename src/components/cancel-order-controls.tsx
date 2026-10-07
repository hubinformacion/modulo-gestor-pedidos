"use client";
import { useState, useTransition } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { cancelOrderAction } from "@/app/seguimiento/[tracking_token]/actions";
import { annulOrderAction } from "@/app/admin/operations";
import { annulPurchaseSchema, cancelPurchaseSchema } from "@/lib/orders/cancellation-validation";
export function CancelOrderControls({ mode, reference, version, hasPayment = false }: { mode: "comprador" | "gestor"; reference: string; version: string; hasPayment?: boolean }) {
  const [open, setOpen] = useState(false); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  const staff = mode === "gestor";
  function confirm() {
    const parsed = staff ? annulPurchaseSchema.safeParse({ id: reference, version, reason }) : cancelPurchaseSchema.safeParse({ token: reference, version, reason });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => { try {
      const result = staff ? await annulOrderAction(parsed.data) : await cancelOrderAction(parsed.data);
      if (result.success) { setOpen(false); setReason(""); setError(""); sileo.success({ title: result.message }); } else setError(result.message);
    } catch { setError("No pudimos guardar el cambio. Reintenta."); } });
  }
  // The public page fills a tall WordPress iframe. An inline confirmation
  // stays visible at the clicked action; a viewport-centred portal may not.
  if (!staff) return <div data-order-editing={open || pending ? "true" : undefined}>{open ? <section aria-labelledby="buyer-cancel-title" className="rounded-lg border border-destructive/20 bg-red-50/30 p-4"><h3 id="buyer-cancel-title" className="text-sm font-semibold">Cancelar pedido</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Se cerrará el pedido y las publicaciones volverán al inventario. Esta acción es definitiva.</p>{hasPayment ? <p className="mt-2 text-xs leading-6 text-amber-900">Si realizaste un depósito, coordina su devolución con Fondo Editorial.</p> : null}<label htmlFor="buyer-cancel-reason" className="mb-2 mt-3 block text-xs font-medium">Motivo (opcional)</label><textarea id="buyer-cancel-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Cuéntanos por qué cancelas tu pedido" maxLength={500} disabled={pending} className="min-h-24 w-full rounded-lg border border-input bg-white p-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary" />{error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}<div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" size="sm" disabled={pending} onClick={confirm}>{pending ? "Guardando…" : "Confirmar cancelación"}</Button><Button variant="outline" size="sm" disabled={pending} onClick={() => { setOpen(false); setError(""); }}>Mantener pedido</Button></div></section> : <Button variant="outline" className="h-10 border-destructive/20 text-xs text-destructive" onClick={() => { if (document.querySelector('[data-order-editing="true"]')) { sileo.info({ title: "Finaliza la carga antes de cancelar." }); return; } setOpen(true); }}>Cancelar pedido</Button>}</div>;
  return <div data-order-editing={open || pending ? "true" : undefined}><AlertDialog.Root open={open} onOpenChange={(value, details) => { if (pending) { details.cancel(); return; } if (value && document.querySelector('[data-order-editing="true"]')) { details.cancel(); sileo.info({ title: "Finaliza la carga o edición antes de cancelar." }); return; } setOpen(value); if (!value) setError(""); }}>
    <AlertDialog.Trigger render={<Button variant="outline" className="h-10 border-destructive/20 text-xs text-destructive" />}>{staff ? "Anular pedido" : "Cancelar pedido"}</AlertDialog.Trigger>
    <AlertDialog.Portal><AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/30" /><AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-xl">
      <AlertDialog.Title className="text-lg font-semibold">{staff ? "Anular pedido" : "Cancelar pedido"}</AlertDialog.Title><AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">Se cerrará el pedido y las publicaciones volverán al inventario. Esta acción es definitiva.</AlertDialog.Description>
      {hasPayment ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-xs leading-6 text-amber-900">La devolución de depósitos, si corresponde, se coordina por separado con Fondo Editorial.</p> : null}
      <label htmlFor={`cancel-reason-${mode}`} className="mb-2 mt-5 block text-xs font-medium">{staff ? "Motivo de la anulación" : "Motivo de la cancelación (opcional)"}</label><textarea id={`cancel-reason-${mode}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={staff ? "Indica por qué se anula el pedido" : "Cuéntanos por qué cancelas tu pedido"} maxLength={500} disabled={pending} className="min-h-24 w-full rounded-lg border border-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary" />
      {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}<div className="mt-5 flex flex-wrap justify-end gap-2"><AlertDialog.Close render={<Button variant="outline" disabled={pending} />}>Mantener pedido</AlertDialog.Close><Button variant="destructive" disabled={pending} onClick={confirm}>{pending ? "Guardando…" : staff ? "Confirmar anulación" : "Confirmar cancelación"}</Button></div>
    </AlertDialog.Popup></AlertDialog.Portal>
  </AlertDialog.Root></div>;
}
