"use client";
import { useState, useTransition } from "react";
import { sileo } from "sileo";
import { assignOrderAction, reviewPaymentAction, dispatchOrderAction } from "@/app/admin/operations";
import { assignmentSchema, dispatchSchema, reviewSchema, type ActionResult } from "@/lib/admin/validation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/order-wizard/fields";
function notify(result: ActionResult) { if (result.success) sileo.success({ title: result.message }); else sileo.error({ title: result.message }); }

export function AssignmentControls({ id, version, mine, assigned, closed }: { id: string; version: string; mine: boolean; assigned: boolean; closed: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (closed) return <p className="text-xs text-muted-foreground">La atención de este pedido está cerrada.</p>;
  if (assigned && !mine) return <p className="rounded-lg bg-muted p-4 text-xs leading-6 text-muted-foreground">Otro gestor atiende este pedido. Puedes consultar sus datos y avances.</p>;
  return <div data-order-editing={pending ? "true" : undefined}><Button className="h-10 px-4" variant={mine ? "outline" : "default"} disabled={pending} onClick={() => {
    const parsed = assignmentSchema.safeParse({ id, version, operation: mine ? "release" : "claim" });
    if (!parsed.success) { setError("Actualiza el pedido."); return; }
    startTransition(async () => { try { const result = await assignOrderAction(parsed.data); notify(result); if (!result.success) setError(result.message); } catch { setError("No se pudo actualizar la atención."); } });
  }}>{pending ? "Guardando…" : mine ? "Dejar atención disponible" : "Atender este pedido"}</Button>{error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}</div>;
}

export function PaymentReview({ id, imprint, receiptId, version }: { id: string; imprint: "universidad" | "instituto"; receiptId: string; version: string }) {
  const [decision, setDecision] = useState<"VERIFICADO" | "RECHAZADO" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  function submit() {
    const parsed = reviewSchema.safeParse({ id, imprint, receiptId, version, decision, reason });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    startTransition(async () => { try { const result = await reviewPaymentAction(parsed.data); notify(result); if (result.success) { setDecision(null); setReason(""); } else setError(result.message); } catch { setError("No se pudo guardar la revisión."); } });
  }
  return <div data-order-editing={decision || pending ? "true" : undefined} className="mt-4 border-t border-border pt-4">{decision ? <><p className="text-xs leading-6">{decision === "VERIFICADO" ? "Confirma que el comprobante corresponde a este sello y cubre su importe completo." : "Explica al comprador qué debe corregir. Este motivo se mostrará en su seguimiento y correo."}</p>{decision === "RECHAZADO" ? <div className="mt-3"><label htmlFor={`rejection-${imprint}`} className="mb-2 block text-xs font-medium">Motivo del rechazo</label><textarea id={`rejection-${imprint}`} placeholder="Ej. El importe no cubre el total del sello. Adjunta el depósito restante." maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} className="min-h-24 w-full rounded-lg border border-input p-3 text-xs leading-6 outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div> : null}<div className="mt-3 flex flex-wrap gap-2"><Button className="h-10 px-3" disabled={pending} variant={decision === "RECHAZADO" ? "destructive" : "default"} onClick={submit}>{pending ? "Guardando…" : decision === "VERIFICADO" ? "Verificar y avisar" : "Rechazar y avisar"}</Button><Button className="h-10" disabled={pending} variant="outline" onClick={() => { setDecision(null); setError(""); }}>Cancelar</Button></div></> : <div className="flex flex-wrap gap-2"><Button className="h-10 px-3" onClick={() => setDecision("VERIFICADO")}>Verificar pago</Button><Button className="h-10 px-3" variant="outline" onClick={() => setDecision("RECHAZADO")}>Solicitar otro comprobante</Button></div>}{error ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{error}</p> : null}</div>;
}

export function DispatchControls({ id, version, status, delivery, initialCourier, initialCode = "", initialUrl = "" }: { id: string; version: string; status: "EN_PREPARACION" | "DESPACHADO"; delivery: boolean; initialCourier: string; initialCode?: string; initialUrl?: string }) {
  const [courier, setCourier] = useState(initialCourier);
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [trackingUrl, setTrackingUrl] = useState(initialUrl);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const next = status === "EN_PREPARACION" ? "DESPACHADO" : "ENTREGADO";
  return <form data-order-editing={pending || courier !== initialCourier || trackingCode !== initialCode || trackingUrl !== initialUrl ? "true" : undefined} onSubmit={(event) => {
    event.preventDefault();
    const parsed = dispatchSchema.safeParse({ id, version, status: next, courier, trackingCode, trackingUrl });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (next === "DESPACHADO" && delivery && !courier.trim()) { setError("Indica el courier para avisar por dónde se envió."); return; }
    startTransition(async () => { try { const result = await dispatchOrderAction(parsed.data); notify(result); if (!result.success) setError(result.message); } catch { setError("No se pudo guardar la entrega."); } });
  }} className="mt-5 space-y-4" noValidate>
    {status === "EN_PREPARACION" && delivery ? <fieldset disabled={pending} className="space-y-4"><Field id="dispatch-courier" label="Courier o transporte" placeholder="Nombre de la empresa de transporte" value={courier} onChange={(event) => setCourier(event.target.value)} maxLength={150} required /><div className="grid gap-4 sm:grid-cols-2"><Field id="dispatch-code" label="Número de guía (opcional)" placeholder="Código de seguimiento" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} maxLength={120} /><Field id="dispatch-url" label="Enlace de seguimiento (opcional)" placeholder="https://…" type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} maxLength={2000} /></div></fieldset> : null}
    <p className="text-xs leading-6 text-muted-foreground">{next === "ENTREGADO" ? "Marca la entrega cuando el comprador haya recibido o recogido sus publicaciones. Le enviaremos la confirmación." : delivery ? "Guarda cuando el pedido se entregue al courier. El comprador recibirá estos datos por correo." : "Guarda cuando las publicaciones estén disponibles en biblioteca. Avisaremos al comprador para que las recoja."}</p>
    <Button className="h-11 px-4" disabled={pending} type="submit">{pending ? "Guardando…" : next === "ENTREGADO" ? "Confirmar entrega y avisar" : delivery ? "Registrar envío y avisar" : "Listo para recoger y avisar"}</Button>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </form>;
}
