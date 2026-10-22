"use client";
import { useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { notifyAction } from "@/components/feedback/notify-action";
import { assignOrderAction, reviewPaymentAction, dispatchOrderAction } from "@/app/admin/operations";
import { assignmentSchema, dispatchSchema, reviewSchema } from "@/modules/orders/domain/management";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/form-fields";
const PickupEvidencePond = dynamic(() => import("@/components/orders/management/pickup-evidence-pond"), { ssr: false, loading: () => <p className="text-xs text-muted-foreground">Cargando área de imagen…</p> });

export function AssignmentControls({ id, version, mine, assigned, closed }: { id: string; version: string; mine: boolean; assigned: boolean; closed: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  if (closed) return <p className="text-xs text-muted-foreground">La atención de este pedido está cerrada.</p>;
  if (assigned && !mine) return <p className="rounded-lg bg-muted p-4 text-xs leading-6 text-muted-foreground">Otro gestor atiende este pedido. Puedes consultar sus datos y avances.</p>;
  return <div data-order-editing={pending ? "true" : undefined}><Button className="h-10 px-4" variant={mine ? "outline" : "default"} disabled={pending} onClick={() => {
    const parsed = assignmentSchema.safeParse({ id, version, operation: mine ? "release" : "claim" });
    if (!parsed.success) { setError("Actualiza el pedido."); return; }
    startTransition(async () => { try { const result = await notifyAction(() => assignOrderAction(parsed.data), { loading: { title: "Actualizando atención", description: "Registramos el cambio de responsable del pedido." }, success: { title: mine ? "Atención liberada" : "Atención asignada", description: mine ? "El pedido quedó disponible para otro gestor." : "La atención quedó asignada. Puedes continuar con la revisión de pagos y la entrega." }, error: { title: "No se pudo cambiar la atención", description: "Actualiza el pedido y comprueba su responsable actual." } }); if (!result.success) setError(result.message); } catch { setError("No se pudo actualizar la atención."); } });
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
    startTransition(async () => { try { const result = await notifyAction(() => reviewPaymentAction(parsed.data), { loading: { title: "Guardando revisión", description: "Registramos la decisión sobre el comprobante." }, success: { title: decision === "VERIFICADO" ? "Pago verificado" : "Corrección solicitada", description: decision === "VERIFICADO" ? "La revisión quedó guardada. La distribución se habilita cuando todos los pagos requeridos están verificados." : "El motivo quedó registrado para que el comprador pueda presentar otro comprobante." }, error: { title: "No se pudo guardar la revisión", description: "Actualiza el pedido y revisa el estado del comprobante." } }); if (result.success) { setDecision(null); setReason(""); } else setError(result.message); } catch { setError("No se pudo guardar la revisión."); } });
  }
  return <div data-order-editing={decision || pending ? "true" : undefined} className="mt-4 border-t border-border pt-4">{decision ? <><p className="text-xs leading-6">{decision === "VERIFICADO" ? "Confirma que el comprobante corresponde a este sello y cubre su importe completo." : "Explica al comprador qué debe corregir. Este motivo se mostrará en su seguimiento y correo."}</p>{decision === "RECHAZADO" ? <div className="mt-3"><label htmlFor={`rejection-${imprint}`} className="mb-2 block text-xs font-medium">Motivo del rechazo</label><textarea id={`rejection-${imprint}`} placeholder="Ej. El importe no cubre el total del sello. Adjunta el depósito restante." maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} disabled={pending} className="min-h-24 w-full rounded-lg border border-input p-3 text-xs leading-6 outline-none focus-visible:ring-2 focus-visible:ring-primary" /></div> : null}<div className="mt-3 flex flex-wrap gap-2"><Button className="h-10 px-3" disabled={pending} variant={decision === "RECHAZADO" ? "destructive" : "default"} onClick={submit}>{pending ? "Guardando…" : decision === "VERIFICADO" ? "Verificar y avisar" : "Rechazar y avisar"}</Button><Button className="h-10" disabled={pending} variant="outline" onClick={() => { setDecision(null); setError(""); }}>Cancelar</Button></div></> : <div className="flex flex-wrap gap-2"><Button className="h-10 px-3" onClick={() => setDecision("VERIFICADO")}>Verificar pago</Button><Button className="h-10 px-3" variant="outline" onClick={() => setDecision("RECHAZADO")}>Solicitar otro comprobante</Button></div>}{error ? <p role="alert" className="mt-3 text-xs leading-6 text-destructive">{error}</p> : null}</div>;
}

export function DispatchControls({ supportContacts = [], id, version, status, delivery, initialCourier, initialCode = "", initialUrl = "", existingEvidenceId = null }: { supportContacts?: { id: string; name: string }[]; existingEvidenceId?: string | null; id: string; version: string; status: "EN_PREPARACION" | "DESPACHADO"; delivery: boolean; initialCourier: string; initialCode?: string; initialUrl?: string }) {
  const [supportContactId, setSupportContactId] = useState("");
  const [courier, setCourier] = useState(initialCourier);
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [trackingUrl, setTrackingUrl] = useState(initialUrl);
  const [uploadedEvidenceId, setEvidenceId] = useState<string | null>(null);
  const evidenceId = uploadedEvidenceId ?? existingEvidenceId;
  const [imageLoading, setImageLoading] = useState(false);
  const [imageIssue, setImageIssue] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const next = status === "EN_PREPARACION" ? "DESPACHADO" : "ENTREGADO";
  return <form data-order-editing={pending || imageLoading || imageIssue || supportContactId || courier !== initialCourier || trackingCode !== initialCode || trackingUrl !== initialUrl ? "true" : undefined} onSubmit={(event) => {
    event.preventDefault();
    const parsed = dispatchSchema.safeParse({ id, version, status: next, courier, trackingCode, trackingUrl, evidenceId, supportContactId: supportContactId || null });
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (next === "DESPACHADO" && delivery && !courier.trim()) { setError("Indica el courier para avisar por dónde se envió."); return; }
    if (next === "DESPACHADO" && !delivery && !supportContactId) { setError("Selecciona a la persona que apoyará con el recojo."); return; }
    if (imageLoading || imageIssue) { setError(imageIssue || "Espera a que termine de cargar la imagen."); return; }
    startTransition(async () => { try { const result = await notifyAction(() => dispatchOrderAction(parsed.data), { loading: { title: next === "ENTREGADO" ? "Confirmando entrega" : "Registrando salida", description: "Guardamos el avance y los datos de entrega del pedido." }, success: { title: next === "ENTREGADO" ? "Entrega registrada" : delivery ? "Despacho registrado" : "Recojo disponible", description: next === "ENTREGADO" ? "El pedido quedó marcado como entregado. La confirmación al comprador se procesa automáticamente." : delivery ? "Los datos del courier y seguimiento quedaron guardados para el comprador." : "Las publicaciones quedaron listas para recoger en la biblioteca indicada." }, error: { title: "No se pudo actualizar la entrega", description: "Conserva los datos y reintenta después de actualizar el pedido." } }); if (!result.success) setError(result.message); else setError(""); } catch { setError("No se pudo registrar la entrega. Puedes reintentar."); } });
  }} className="mt-3 space-y-3" noValidate>
    {status === "EN_PREPARACION" && delivery ? <fieldset disabled={pending} className="grid items-end gap-3 lg:grid-cols-3"><Field id="dispatch-courier" label="Courier o transporte" placeholder="Nombre de la empresa de transporte" value={courier} onChange={(event) => setCourier(event.target.value)} maxLength={150} required /><div className="grid gap-3 sm:grid-cols-2 lg:col-span-2"><Field id="dispatch-code" label="Número de guía (opcional)" placeholder="Código de seguimiento" value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} maxLength={120} /><Field id="dispatch-url" label="Enlace de seguimiento (opcional)" placeholder="https://…" type="url" value={trackingUrl} onChange={(event) => setTrackingUrl(event.target.value)} maxLength={2000} /></div></fieldset> : null}
    {status === "EN_PREPARACION" && !delivery ? <div className="max-w-lg"><SelectField id="pickup-support-person" label="Personal de apoyo para el recojo" value={supportContactId} onValueChange={setSupportContactId} disabled={pending} required><option value="">Selecciona una persona</option>{supportContacts.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</SelectField>{!supportContacts.length ? <p className="mt-2 text-xs leading-6 text-muted-foreground">Registra personal activo en Configuración → Apoyo para recojo para continuar.</p> : <p className="mt-2 text-xs leading-6 text-muted-foreground">Recibirá los datos del recojo en un correo separado, con copia a los gestores. El comprador solo verá su nombre.</p>}</div> : null}
    {status === "DESPACHADO" ? <div className="rounded-lg border border-border p-3"><p className="mb-2 text-xs font-semibold">{delivery ? "Evidencia del courier (opcional)" : "Foto del recojo (opcional)"}</p><PickupEvidencePond id={id} version={version} disabled={pending} existingEvidenceId={evidenceId} onUploaded={setEvidenceId} onBusyChange={setImageLoading} onErrorChange={setImageIssue} /></div> : null}
    {next !== "ENTREGADO" ? <p className="text-xs leading-6 text-muted-foreground">{delivery ? "Guarda cuando el pedido se entregue al courier. El comprador recibirá estos datos por correo." : "Guarda cuando las publicaciones estén disponibles en biblioteca. Avisaremos al comprador para que las recoja."}</p> : null}
    <Button className="h-11 px-4" disabled={pending || imageLoading || Boolean(imageIssue) || (next === "DESPACHADO" && !delivery && !supportContactId)} type="submit">{pending ? "Guardando…" : next === "ENTREGADO" ? "Confirmar entrega y avisar" : delivery ? "Registrar envío y avisar" : "Listo para recoger y avisar"}</Button>{error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
  </form>;
}
