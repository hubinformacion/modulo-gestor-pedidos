"use client";

import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { reviewPaymentAction, dispatchOrderAction } from "@/app/admin/operations";
import { dispatchSchema, reviewSchema, type ActionResult } from "@/lib/admin/validation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/order-wizard/fields";

function notify(result: ActionResult) {
  if (result.success) sileo.success({ title: result.message });
  else sileo.error({ title: "No se pudo guardar", description: result.message });
}
export function PaymentReview({ id, imprint, receiptId, version }: { id: string; imprint: "universidad" | "instituto"; receiptId: string; version: string }) {
  const [decision, setDecision] = useState<"VERIFICADO" | "RECHAZADO" | null>(null);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  function submit() {
    const parsed = reviewSchema.safeParse({ id, imprint, receiptId, version, decision });
    if (!parsed.success) { setMessage({ success: false, message: "Selecciona una decisión válida." }); return; }
    startTransition(async () => {
      try { const result = await reviewPaymentAction(parsed.data); setMessage(result); notify(result); if (result.success) setDecision(null); }
      catch { setMessage({ success: false, message: "No se pudo guardar. Actualiza la página." }); }
    });
  }
  return <div className="mt-5 border-t border-border pt-4">
    {decision ? <div><p className="text-xs leading-6">{decision === "VERIFICADO" ? "Confirma que el depósito corresponde a este sello y cubre su importe completo." : "El comprador podrá subir un nuevo comprobante de este sello. El otro pago conserva su estado."}</p><div className="mt-3 flex flex-wrap gap-2"><Button disabled={pending} variant={decision === "RECHAZADO" ? "destructive" : "default"} onClick={submit}>{pending ? "Guardando…" : decision === "VERIFICADO" ? "Confirmar aprobación" : "Confirmar rechazo"}</Button><Button disabled={pending} variant="outline" onClick={() => setDecision(null)}>Cancelar</Button></div></div> : <div className="flex flex-wrap gap-2"><Button onClick={() => setDecision("VERIFICADO")}>Aprobar pago</Button><Button variant="outline" onClick={() => setDecision("RECHAZADO")}>Rechazar</Button></div>}
    {message ? <p role={message.success ? "status" : "alert"} className={`mt-3 text-xs leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}
  </div>;
}

export function DispatchControls({ id, version, status, delivery, initialCourier }: { id: string; version: string; status: "EN_PREPARACION" | "DESPACHADO"; delivery: boolean; initialCourier: string }) {
  const [courier, setCourier] = useState(initialCourier);
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const next = status === "EN_PREPARACION" ? "DESPACHADO" : "ENTREGADO";
  return <form onSubmit={(event) => {
    event.preventDefault();
    const parsed = dispatchSchema.safeParse({ id, version, status: next, courier });
    if (!parsed.success || (next === "DESPACHADO" && delivery && !courier.trim())) { setMessage({ success: false, message: "Indica un courier válido para el envío." }); return; }
    startTransition(async () => {
      try { const result = await dispatchOrderAction(parsed.data); setMessage(result); notify(result); }
      catch { setMessage({ success: false, message: "No se pudo guardar. Actualiza la página." }); }
    });
  }} className="mt-5 space-y-4" noValidate>
    {status === "EN_PREPARACION" && delivery ? <Field id="dispatch-courier" label="Courier" placeholder="Nombre de la empresa de transporte" value={courier} onChange={(event) => setCourier(event.target.value)} maxLength={150} required disabled={pending} /> : null}
    <p className="text-xs leading-6 text-muted-foreground">{next === "ENTREGADO" ? "Confirma este paso cuando la persona haya recibido o recogido sus publicaciones." : delivery ? "Confirma cuando el pedido se entregue al courier." : "Confirma cuando el pedido esté listo en biblioteca para el recojo."}</p>
    <Button disabled={pending} type="submit">{pending ? "Guardando…" : next === "ENTREGADO" ? "Marcar como entregado" : delivery ? "Registrar despacho" : "Marcar listo para recojo"}</Button>
    {message ? <p role={message.success ? "status" : "alert"} className={`text-xs leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}
  </form>;
}
