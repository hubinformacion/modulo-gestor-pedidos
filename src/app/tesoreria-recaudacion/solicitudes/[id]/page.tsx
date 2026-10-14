import { formatRequestNumber } from "@/lib/orders/number";
import { PurchaseDetail } from "@/components/orders/purchase-detail";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { UserRound, ReceiptText, CreditCard, MessageSquareWarning, ArrowUpRight, FileText, Check } from "lucide-react";
import { cajaDetail } from "@/lib/caja/data";
import { cajaLabels } from "@/lib/caja/validation";
import { formatMoney, toCents } from "@/lib/orders/money";
import { BillingBadge } from "@/components/caja/billing-badge";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { PdfPreview } from "@/components/caja/pdf-preview";
import { SaleDocumentControls } from "@/components/caja/document-controls";
import { CajaAssignmentControls } from "@/components/caja/assignment-controls";
import { OrderLiveRefresh } from "@/components/order-live-refresh";
import { TreasuryComposer } from "@/components/treasury/composer";
import { AuxiliaryPanels } from "@/components/workspace/auxiliary-panels";
const dates = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });

export default async function TreasuryRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const detail = await cajaDetail(parsed.data);
  if (!detail) notFound();
  const { request, order, items, receipts, documents, history, actorId, service, notes, activity, observations, supporting } = detail;
  const closed = ["FINALIZADA", "ANULADA"].includes(request.status);
  const mine = request.assignedTo === actorId && !service;
  const version = request.updatedAt.toISOString();
  const openObservations = observations.filter((item) => !item.resolvedAt);
  const fileLink = (file: { id: string; driveReady: boolean; driveViewUrl: string | null }) => file.driveReady ? file.driveViewUrl! : `/tesoreria-recaudacion/${request.id}/archivos/${file.id}`;
  const draft = documents.find((item) => item.id === request.draftDocumentId);
  const finalized = documents.find((item) => item.id === request.finalizedDocumentId);
  const notesPanel = <section><p className="text-xs leading-6 text-muted-foreground">Exclusivas del equipo de Tesorería Recaudación.</p>{!service ? <TreasuryComposer note id={request.id} version={version} /> : null}<ul tabIndex={0} aria-label="Notas internas de Tesorería Recaudación" className="mt-5 max-h-96 space-y-4 overflow-y-auto overscroll-contain">{notes.map((note) => <li key={note.id} className="border-t border-border pt-3 text-xs"><p className="whitespace-pre-wrap leading-6">{note.content}</p><p className="mt-2 text-[10px] text-muted-foreground">{note.actorName} · {dates.format(note.createdAt)}</p></li>)}</ul></section>;
  const historyPanel = <section><ul tabIndex={0} aria-label="Historial de atención de la solicitud" className="max-h-96 space-y-4 overflow-y-auto overscroll-contain">{activity.map((event) => <li key={event.id} className="border-l-2 border-primary/20 pl-4 text-xs"><p className="leading-6">{event.detail}</p><p className="mt-2 text-[10px] text-muted-foreground">{event.actorName} · {dates.format(event.createdAt)}</p></li>)}</ul>{!activity.length ? <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p> : null}</section>;

  return <>
    <Link href="/tesoreria-recaudacion/solicitudes" className="text-xs font-medium text-primary hover:underline">← Volver a solicitudes</Link>
    <header className="treasury-case-heading">
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h1 className="page-heading">Solicitud {formatRequestNumber(request.requestNumber)}</h1><BillingBadge invoice={Boolean(order.billingRuc)} /></div><div className="treasury-heading-badges"><ImprintBadge imprint={request.publisherImprint} /><span className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-[10px] font-semibold text-primary">{openObservations.length && !closed ? "Observada" : cajaLabels[request.status]}</span><span className="text-[10px] text-muted-foreground">{dates.format(request.createdAt)}</span></div></div>
      <div className="treasury-heading-tools"><div className="flex max-w-full flex-wrap items-center gap-2"><AuxiliaryPanels area="treasury" notes={notesPanel} history={historyPanel} notesCount={notes.length} historyCount={activity.length} /><OrderLiveRefresh finished={closed} /></div><p className="treasury-requester"><span>Solicitante · </span><strong>{order.requesterName ?? "Sin gestor asignado"}</strong></p></div>
    </header>
    {!closed && !service ? <CajaAssignmentControls key={`${request.id}:${request.assignedTo ?? "unassigned"}:${request.assignedAt?.toISOString() ?? ""}`} id={request.id} version={version} mine={mine} assigned={Boolean(request.assignedTo)} assignedName={request.assignedName} /> : <p className="mt-4 text-xs text-muted-foreground">{service ? "Buzón de servicio · Solo consulta. La atención requiere una cuenta personal autorizada." : `Responsable de emisión: ${request.assignedName ?? "Sin asignar"}`}</p>}

    <div className="treasury-case-workspace">
      <div className="min-w-0 space-y-5">
        <section className="treasury-recipient" aria-labelledby="recipient-heading">
          <div className="treasury-recipient-heading"><span className="detail-card-icon"><UserRound aria-hidden="true" /></span><h2 id="recipient-heading">Destinatario del comprobante</h2></div>
          <div className="treasury-recipient-content">
            <div className="treasury-billing-identity">
              <p className="treasury-field-label">{order.billingRuc ? "Razón social" : "Nombre completo"}</p>
              <p className="treasury-recipient-name">{order.billingRuc ? order.billingBusinessName : order.name}</p>
              <p className="treasury-recipient-document"><span>{order.billingRuc ? "RUC" : "Documento"}</span>{order.billingRuc || order.document}</p>
              {order.billingRuc ? <div className="treasury-billing-address"><p className="treasury-field-label">Dirección fiscal</p><p>{order.billingAddress ?? "Pendiente de subsanación"}</p></div> : null}
            </div>
            <div className="treasury-buyer-contact"><h3>Contacto del comprador</h3><dl>{[...(order.billingRuc ? [["Nombre", order.name], ["Documento", order.document]] : []), ["Correo electrónico", order.email], ["Celular", order.phone]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div>
          </div>
        </section>

        <PurchaseDetail items={items} subtotal={order.subtotal} shipping={order.shipping} total={order.total} totalLabel="Total a emitir" description="Publicaciones e importes de esta unidad de negocio." />

        <div className="treasury-review-columns">
        <section className="treasury-payment" aria-labelledby="payment-heading">
          <div className="detail-card-heading"><span className="detail-card-icon"><CreditCard aria-hidden="true" /></span><div><h2 id="payment-heading">Comprobantes de pago</h2><p>Verificados por el área de Fondo Editorial.</p></div><span className="treasury-payment-verified"><Check className="size-3.5" aria-hidden="true" />Pago verificado</span></div>
          <ul className="treasury-payment-list">{receipts.map((file,index) => <li key={file.id} className="treasury-payment-file"><FileText className="mt-1 size-5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><a href={fileLink(file)} target="_blank" rel="noopener noreferrer" className="break-words text-xs font-semibold leading-6 text-primary underline underline-offset-4">{file.fileName}</a><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{index === 0 ? "Último comprobante" : "Adjunto anterior"} · {dates.format(file.uploadedAt)}</p>{file.driveReady ? <a href={`/tesoreria-recaudacion/${request.id}/archivos/${file.id}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[10px] text-muted-foreground underline">Restablecer acceso</a> : <p className="mt-2 text-[10px] leading-5 text-muted-foreground">El enlace preparará el acceso privado al abrirlo.</p>}</div><ArrowUpRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></li>)}</ul>{!receipts.length ? <p className="px-6 pb-6 text-xs leading-6 text-muted-foreground">No hay comprobantes disponibles para esta solicitud.</p> : null}
        </section>

        <section id={`treasury-observations-${request.id}`} className="treasury-case-sheet scroll-mt-24 p-5 sm:p-6"><div className="detail-card-heading"><span className="detail-card-icon"><MessageSquareWarning aria-hidden="true" /></span><div><h2>Observaciones y correcciones</h2><p>Coordina los datos pendientes con Fondo Editorial.</p></div></div>{observations.length ? <ul className="my-4 space-y-3">{observations.map((item) => <li key={item.id} className={`rounded-xl border p-4 text-xs ${item.resolvedAt ? "border-border" : "border-amber-200 bg-amber-50"}`}><p className="font-semibold">{item.resolvedAt ? "Resuelta" : "Pendiente"}</p><p className="mt-2 whitespace-pre-wrap leading-6">{item.content}</p><p className="mt-2 text-[10px] text-muted-foreground">{item.actorName} · {dates.format(item.createdAt)}</p>{item.resolvedAt ? <div className="mt-3 border-t border-border pt-3"><p className="font-semibold">Respuesta de Fondo Editorial</p><p className="mt-1 whitespace-pre-wrap leading-6">{item.response}</p><p className="mt-1 text-[10px] text-muted-foreground">{item.resolvedBy} · {dates.format(item.resolvedAt)}</p></div> : null}</li>)}</ul> : <p className="mb-4 text-xs text-muted-foreground">Sin observaciones registradas.</p>}{mine && !closed ? <TreasuryComposer id={request.id} version={version} /> : null}{supporting.length ? <div className="mt-5 border-t border-border pt-5"><h3 className="text-xs font-semibold">Documentos de subsanación</h3><ul className="mt-3 space-y-3">{supporting.map((file) => <li key={file.id}><a href={`/tesoreria-recaudacion/${request.id}/archivos/${file.id}`} target="_blank" rel="noopener noreferrer" className="break-words text-xs text-primary underline">{file.fileName}</a></li>)}</ul></div> : null}</section>
        </div>
      </div>

      <aside className="treasury-issue-column" aria-label="Emisión del documento">
        <section className="treasury-issue-panel"><div className="treasury-issue-heading"><span className="detail-card-icon"><ReceiptText aria-hidden="true" /></span><p className="workspace-page-eyebrow mt-4">Documento de venta</p><h2>{closed || service ? "Documento de la solicitud" : `Emitir ${order.billingRuc ? "factura" : "boleta"}`}</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{service ? "Consulta los datos y documentos de emisión. La atención corresponde al personal autorizado." : closed ? "Consulta el PDF vigente de esta emisión." : "Revisa los datos, adjunta el PDF y finaliza la solicitud."}</p></div><div className="treasury-issue-body">
          <div className="mb-5 flex items-center justify-between gap-3 rounded-lg bg-secondary/50 px-4 py-3"><span className="text-[10px] font-medium text-muted-foreground">Importe a emitir</span><strong className="text-sm tabular-nums text-primary">{formatMoney(toCents(order.total))}</strong></div>
          {request.returnReason && request.status === "DEVUELTA" ? <div className="mb-4 rounded-lg bg-amber-50 p-4 text-xs leading-6"><strong>Documento devuelto por Fondo Editorial</strong><p>{request.returnReason}</p></div> : null}
          {closed ? <div className="space-y-3"><p className="text-xs font-medium">{cajaLabels[request.status]}</p>{finalized ? <PdfPreview requestId={request.id} documentId={finalized.id} name={finalized.fileName} /> : null}</div> : openObservations.length ? <p className="rounded-lg bg-amber-50 p-4 text-xs leading-6">Fondo Editorial debe resolver las observaciones antes de finalizar la emisión.</p> : mine ? <SaleDocumentControls key={`${request.cycle}:${version}`} id={request.id} cycle={request.cycle} initialVersion={version} initialDocument={draft ? { id: draft.id, name: draft.fileName, size: draft.size, href: fileLink(draft) } : null} /> : <div className="space-y-3"><p className="text-xs leading-6 text-muted-foreground">{service ? "El buzón de servicio tiene acceso de consulta." : request.assignedTo ? "La solicitud está a cargo de otra persona. Puedes consultar sus documentos." : "Toma la atención para emitir el documento."}</p>{draft ? <PdfPreview requestId={request.id} documentId={draft.id} name={draft.fileName} /> : null}</div>}
          {history.length ? <details className="mt-5 border-t border-border pt-4"><summary className="text-xs font-semibold">Documentos anteriores</summary><ul className="mt-3 space-y-3">{history.map((file) => <li key={file.id} className="text-xs"><a href={fileLink(file)} target="_blank" rel="noopener noreferrer" className="break-words text-primary underline">{file.fileName}</a><p className="mt-1 text-[10px] text-muted-foreground">{dates.format(file.uploadedAt!)}</p></li>)}</ul></details> : null}
        </div></section>
      </aside>
    </div>
  </>;
}
