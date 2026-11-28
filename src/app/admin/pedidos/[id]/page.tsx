import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { asc, eq } from "drizzle-orm";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { z } from "zod";

import { withReadDatabase } from "@/db";
import { pickupContacts, pickupNotifications } from "@/db/schema";
import { ImprintBadge } from "@/components/catalog/imprint-badge";
import { CancelOrderControls } from "@/components/orders/cancel-order-controls";
import { OrderLiveRefresh } from "@/components/orders/live-refresh";
import { AttachmentPreview } from "@/components/orders/management/attachment-preview";
import { AttentionTabs } from "@/components/orders/management/attention-tabs";
import { InternalNoteComposer } from "@/components/orders/management/internal-note-composer";
import { AssignmentControls, DispatchControls, PaymentReview } from "@/components/orders/management/order-controls";
import { StatusBadge } from "@/components/orders/management/status-badge";
import { TreasuryPaymentNoticeStatus } from "@/components/orders/management/treasury-payment-notice-status";
import { PurchaseDetail } from "@/components/orders/purchase-detail";
import { AdminSaleDocuments } from "@/components/orders/sale-documents";
import { AuxiliaryPanels } from "@/components/workspace/auxiliary-panels";
import { requirePageAccess } from "@/modules/access/application/session";
import { canAttendOrders } from "@/modules/access/domain/policy";
import { orderDetail } from "@/modules/orders/application/queries";
import { listTreasuryPaymentNoticeStatuses } from "@/modules/orders/data/treasury-payment-notices";
import { centsToDecimal, formatMoney, toCents } from "@/modules/orders/domain/money";
import { formatOrderNumber } from "@/modules/orders/domain/number";
import { imprintNames } from "@/modules/orders/domain/types";

export const metadata: Metadata = { title: "Atención del pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
export const maxDuration = 180;

const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
const supportNoticeLabels: Record<string, string> = {
  ENVIADO: "Enviado", ERROR: "No se pudo enviar", OMITIDO: "Omitido",
};
const linkClass = "inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline";

function StepHeading({ title, instruction }: { title: string; instruction: string }) {
  return <header className="space-y-1.5">
    <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
    <p className="max-w-prose text-sm leading-6 text-muted-foreground">{instruction}</p>
  </header>;
}

function Facts({ rows, wide = false }: { rows: [string, ReactNode][]; wide?: boolean }) {
  return <dl className={`grid min-w-0 grid-cols-1 gap-x-5 gap-y-3 min-[360px]:grid-cols-2 ${wide ? "order-detail-facts" : ""}`}>
    {rows.map(([label, value]) => (
      <div key={label} className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium leading-5">{value}</dd>
      </div>
    ))}
  </dl>;
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAccess();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const detail = await orderDetail(parsed.data);
  if (!detail) notFound();

  const { order, items, receipts, activity, notes, evidence } = detail;
  const delivery = order.deliveryType === "delivery";
  const cancelled = order.orderStatus === "CANCELADO";
  const delivered = order.orderStatus === "ENTREGADO";
  const closed = delivered || cancelled;
  const canAttend = canAttendOrders(actor);
  const mine = canAttend && order.assignedTo === actor.userId;
  const canDispatch = mine && order.orderStatus === "EN_PREPARACION";
  const canDeliver = mine && order.orderStatus === "DESPACHADO";
  const version = order.updatedAt.toISOString();

  const applicable = (["universidad", "instituto"] as const).flatMap((imprint) => {
    const status = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
    if (status === "NO_APLICA") return [];
    return [{
      imprint, status,
      amount: imprint === "universidad" ? order.totalUniversidad : order.totalInstituto,
      reason: imprint === "universidad" ? order.rejectionUniversidad : order.rejectionInstituto,
      files: receipts.filter((file) => file.publisherImprint === imprint),
    }];
  });
  const allVerified = applicable.length > 0 && applicable.every(({ status }) => status === "VERIFICADO");
  const progress = delivered || order.orderStatus === "DESPACHADO" || order.dispatchedAt ? 3
    : allVerified || order.orderStatus === "EN_PREPARACION" ? 2
    : order.assignedTo ? 1 : 0;
  const current = !closed && !order.assignedTo ? 0 : progress;

  const [supportContacts, supportNotice, treasuryNotices] = await Promise.all([
    canDispatch && !delivery ? withReadDatabase((db) => db.select({ id: pickupContacts.id, name: pickupContacts.name })
      .from(pickupContacts).where(eq(pickupContacts.status, "ACTIVO")).orderBy(asc(pickupContacts.name))) : [],
    order.pickupContactName ? withReadDatabase(async (db) => {
      const [notice] = await db.select({ status: pickupNotifications.status }).from(pickupNotifications)
        .where(eq(pickupNotifications.orderId, order.id)).limit(1);
      return notice;
    }) : undefined,
    listTreasuryPaymentNoticeStatuses(order.id),
  ]);

  const assignedLabel = order.assignedName || (order.assignedTo ? "Gestor asignado" : "Por asignar");
  const waitingForManager = !canAttend ? "Tu cuenta permite consultar este pedido." : order.assignedTo
    ? "El gestor asignado registra este paso." : "Toma la atención del pedido en el paso 1 para continuar.";
  const canCancel = mine && (order.orderStatus === "PENDIENTE_PAGO" || order.orderStatus === "EN_PREPARACION");
  const deliveryAddressParts = [order.deliveryDistrict, order.deliveryProvince, order.deliveryDepartment].filter(Boolean);
  const canReview = mine && order.orderStatus === "PENDIENTE_PAGO";
  const paymentInstruction = closed ? "Consulta los comprobantes y documentos de venta registrados."
    : !mine ? waitingForManager
    : allVerified ? "Los pagos están verificados. Los documentos de venta se pueden confirmar en esta sección."
    : applicable.some(({ status }) => status === "EN_REVISION") ? "Abre el comprobante reciente y verifica el importe del sello correspondiente."
    : "Espera los comprobantes del comprador para verificar los depósitos.";
  const deliveryInstruction = delivered ? "La entrega quedó confirmada."
    : cancelled ? "La entrega quedó cancelada."
    : canDeliver ? delivery ? "Confirma la entrega cuando el comprador reciba las publicaciones." : "Confirma la entrega cuando el comprador recoja las publicaciones."
    : order.orderStatus === "DESPACHADO" ? waitingForManager
    : "Registra la salida en Distribución para habilitar la confirmación de entrega.";

  const deliveryFacts: [string, ReactNode][] = [];
  if (order.dispatchedAt) deliveryFacts.push([delivery ? "Salida" : "Disponible desde", dateFormat.format(order.dispatchedAt)]);
  if (order.deliveredAt) deliveryFacts.push(["Entregado el", dateFormat.format(order.deliveredAt)]);
  if (order.courier) deliveryFacts.push(["Courier", order.courier]);
  if (order.shippingTrackingCode) deliveryFacts.push(["Guía", order.shippingTrackingCode]);
  if (order.pickupContactName) {
    deliveryFacts.push([
      "Apoyo para el recojo",
      <>{order.pickupContactName}{order.pickupContactEmail ? <span className="block font-normal text-muted-foreground">{order.pickupContactEmail}</span> : null}</>,
    ], ["Aviso al apoyo", supportNoticeLabels[supportNotice?.status ?? ""] ?? "Registrado"]);
  }

  function receiptRow(file: (typeof receipts)[number], latest = false) {
    return <li key={file.id} className="min-w-0 py-2 first:pt-0">
      <div className="mb-2 flex items-start gap-2">
        <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <a href={file.driveViewUrl} target="_blank" rel="noopener noreferrer" className="break-words text-sm font-medium text-primary underline-offset-4 hover:underline">{file.fileName}</a>
          <p className="mt-0.5 text-xs text-muted-foreground">{dateFormat.format(file.uploadedAt)}{latest ? " · Más reciente" : ""}</p>
        </div>
      </div>
      <AttachmentPreview kind="comprobante" orderId={order.id} fileId={file.id} name={file.fileName} mimeType={file.mimeType} />
    </li>;
  }

  const showDeliverySummary = deliveryFacts.length > 0 || Boolean(order.shippingTrackingUrl);
  const deliveryEvidence = canDeliver ? evidence.slice(1) : evidence;
  const panels = [
    <div key="attention" className="space-y-5">
      <StepHeading title="Atención del pedido" instruction={closed
        ? "Consulta quién atendió el pedido y la información registrada."
        : !canAttend ? waitingForManager
        : mine ? "Revisa los datos de compra antes de validar los pagos."
        : order.assignedTo ? "Consulta los datos de la compra y su responsable."
        : "Toma la atención para gestionar el pedido."} />
      <section aria-labelledby="order-assignee" className="flex flex-col justify-between gap-3 border-y border-border py-3 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h3 id="order-assignee" className="text-xs text-muted-foreground">Responsable</h3>
          <p className="mt-1 break-words text-sm font-semibold">{assignedLabel}</p>
          {order.assignedAt ? <p className="mt-1 text-xs text-muted-foreground">Desde {dateFormat.format(order.assignedAt)}</p> : null}
        </div>
        <div className="flex flex-wrap items-start gap-2">
          {canAttend && !closed && (!order.assignedTo || mine) ? <AssignmentControls id={order.id} version={version} assigned={Boolean(order.assignedTo)} mine={mine} closed={closed} /> : null}
          {canCancel ? <CancelOrderControls mode="gestor" reference={order.id} version={version} hasPayment={receipts.length > 0} /> : null}
        </div>
      </section>
      <div className={order.billingRuc ? "order-detail-pair grid gap-x-8 gap-y-4" : ""}>
        <section aria-labelledby="order-customer" className="min-w-0">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 id="order-customer" className="text-base font-semibold">Comprador</h3>
            <span className="text-xs text-muted-foreground">{order.customerType === "comunidad_continental" ? "Comunidad Continental" : "Público general"}</span>
          </div>
          <Facts wide={!order.billingRuc} rows={[
            ["Nombre", order.customerName], ["Documento", order.customerDocument],
            ["Correo", order.customerEmail], ["Celular", order.customerPhone],
          ]} />
        </section>
        {order.billingRuc ? <section aria-labelledby="order-billing" className="min-w-0">
          <h3 id="order-billing" className="mb-3 text-base font-semibold">Datos de facturación</h3>
          <Facts rows={[
            ["Razón social", order.billingBusinessName], ["RUC", order.billingRuc],
            ["Dirección fiscal", order.billingAddress || "Sin dirección registrada"],
          ]} />
        </section> : null}
      </div>
      <PurchaseDetail
        items={items}
        subtotal={centsToDecimal(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))}
        shipping={order.shippingCost}
        total={order.total}
        discountTotal={order.discountTotal}
        couponCode={order.couponCode}
      />
    </div>,

    <div key="payments" className="space-y-5">
      <StepHeading title="Pagos del pedido" instruction={paymentInstruction} />
      <div className="divide-y divide-border border-y border-border">
        {applicable.map(({ imprint, status, amount, files, reason }) => {
          const notice = treasuryNotices.find((item) => item.publisherImprint === imprint);
          const latest = files[0];
          const review = canReview && status === "EN_REVISION" && latest;
          const hasDecision = Boolean(reason || review || notice);
          return <section key={imprint} aria-label={imprintNames[imprint]} className="space-y-3 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ImprintBadge imprint={imprint} />
                <StatusBadge status={status} />
              </div>
              <p className="text-xs text-muted-foreground">Importe <strong className="ml-1 text-base font-semibold text-foreground tabular-nums">{formatMoney(toCents(amount))}</strong></p>
            </div>
            <div className={hasDecision ? "order-detail-pair grid gap-x-8 gap-y-4" : ""}>
              <div className="min-w-0">
                {latest ? <ul aria-label="Comprobante más reciente">{receiptRow(latest, true)}</ul> : <p className="text-sm text-muted-foreground">El comprador aún no adjunta un comprobante.</p>}
                {files.length > 1 ? <details className="mt-1">
                  <summary className="cursor-pointer text-xs font-medium text-primary">Otros comprobantes ({files.length - 1})</summary>
                  <ul className="mt-2 divide-y divide-border">{files.slice(1).map((file) => receiptRow(file))}</ul>
                </details> : null}
              </div>
              {hasDecision ? (
                <div className="min-w-0 space-y-3">
                  {reason ? <p className="rounded-md bg-rose-50 px-3 py-2 text-sm leading-5 text-rose-800"><span className="font-medium">Motivo:</span> {reason}</p> : null}
                  {review ? <PaymentReview id={order.id} imprint={imprint} receiptId={review.id} /> : null}
                  <TreasuryPaymentNoticeStatus notice={notice} cancelled={cancelled} />
                </div>
              ) : null}
            </div>
          </section>;
        })}
      </div>
      <AdminSaleDocuments orderId={order.id} actor={actor} invoice={Boolean(order.billingRuc)} />
    </div>,

    <div key="distribution" className="space-y-5">
      <StepHeading title="Distribución" instruction={canDispatch ? (delivery
        ? "Prepara las publicaciones y registra el courier cuando las despaches."
        : "Prepara las publicaciones y avisa cuando estén disponibles en la biblioteca.")
        : cancelled ? "El pedido fue cancelado antes de completar la distribución."
        : order.dispatchedAt ? `Salida registrada el ${dateFormat.format(order.dispatchedAt)}.`
        : !allVerified ? "La salida se habilita cuando todos los pagos estén verificados."
        : waitingForManager} />
      {canDispatch ? (
        <section aria-labelledby="order-dispatch" className="border-y border-border py-4">
          <h3 id="order-dispatch" className="text-base font-semibold">{delivery ? "Registrar envío" : "Registrar disponibilidad para recojo"}</h3>
          <DispatchControls id={order.id} version={version} status="EN_PREPARACION" supportContacts={supportContacts} delivery={delivery}
            initialCourier={order.courier ?? ""} initialCode={order.shippingTrackingCode ?? ""} initialUrl={order.shippingTrackingUrl ?? ""} />
        </section>
      ) : null}
      <div className="order-detail-pair grid gap-x-8 gap-y-5">
        <section aria-labelledby="order-destination" className="min-w-0">
          <h3 id="order-destination" className="text-base font-semibold">{delivery ? "Destino del envío" : "Lugar de recojo"}</h3>
          <address className="mt-2 space-y-1 break-words text-sm not-italic leading-5">
            <p className="font-medium">{order.deliveryAddress}</p>
            {!delivery && order.deliveryLibraryLocation ? <p>{order.deliveryLibraryLocation}</p> : null}
            {!delivery && order.deliveryPickupHours ? <p>{order.deliveryPickupHours}</p> : null}
            {deliveryAddressParts.length ? <p className="text-muted-foreground">{deliveryAddressParts.join(", ")}</p> : null}
            {order.deliveryReference ? <p className="text-muted-foreground">Referencia: {order.deliveryReference}</p> : null}
            {order.deliveryMapUrl ? <a href={order.deliveryMapUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Abrir mapa <ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
          </address>
          <h4 className="mb-2 mt-4 text-sm font-semibold">{delivery ? "Quién recibe" : "Quién recoge"}</h4>
          <Facts rows={[
            ["Nombre", order.deliveryRecipient],
            ["Documento", order.deliveryRecipientDocument ?? order.customerDocument],
            ["Celular", order.deliveryRecipientPhone ?? order.customerPhone],
          ]} />
        </section>

        <section aria-labelledby="order-packing" className="min-w-0">
          <h3 id="order-packing" className="text-base font-semibold">Publicaciones a preparar</h3>
          <ul className="mt-2 divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex min-w-0 items-start gap-2.5 py-2 first:pt-0">
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums" aria-label={`${item.quantity} ejemplares`}>{item.quantity}</span>
                <div className="min-w-0 space-y-1">
                  <p className="break-words text-sm font-medium leading-5">{item.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{item.code ? <span>{item.code}</span> : null}<ImprintBadge imprint={item.imprint} /></div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>,

    <div key="delivery" className="space-y-5">
      <StepHeading title="Entrega" instruction={deliveryInstruction} />
      <div className={showDeliverySummary && (canDeliver || deliveryEvidence.length > 0) ? "order-detail-pair grid gap-x-8 gap-y-5" : "space-y-5"}>
        {canDeliver ? <section aria-labelledby="order-confirm-delivery" className="min-w-0 border-t border-border pt-4">
          <h3 id="order-confirm-delivery" className="text-base font-semibold">Confirmar entrega</h3>
          <DispatchControls id={order.id} version={version} status="DESPACHADO" existingEvidenceId={evidence[0]?.id ?? null}
            delivery={delivery} initialCourier={order.courier ?? ""} />
        </section> : null}
        {showDeliverySummary ? (
          <section aria-labelledby="order-delivery-summary" className="min-w-0 border-t border-border pt-4">
            <h3 id="order-delivery-summary" className="mb-3 text-base font-semibold">{delivery ? "Seguimiento del envío" : "Seguimiento del recojo"}</h3>
            <Facts rows={deliveryFacts} />
            {order.shippingTrackingUrl ? <a href={order.shippingTrackingUrl} target="_blank" rel="noopener noreferrer" className={`mt-3 ${linkClass}`}>Consultar envío <ArrowUpRight aria-hidden="true" className="size-3.5" /></a> : null}
          </section>
        ) : null}
        {deliveryEvidence.length ? (
          <section aria-labelledby="order-evidence" className={`min-w-0 border-t border-border pt-4 ${canDeliver ? "col-span-full" : ""}`}>
            <h3 id="order-evidence" className="text-base font-semibold">{canDeliver ? "Evidencias anteriores" : "Evidencia de entrega"}</h3>
            <ul className="mt-2 divide-y divide-border">
              {deliveryEvidence.map((file) => (
                <li key={file.id} className="min-w-0 py-2">
                  <a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className={`break-words ${linkClass}`}>{file.fileName}</a>
                  <p className="mt-0.5 text-xs text-muted-foreground">{file.actorName} · {dateFormat.format(file.confirmedAt ?? file.uploadedAt!)}</p>
                  <AttachmentPreview kind="evidencia" orderId={order.id} fileId={file.id} name={file.fileName} mimeType={file.mimeType} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>,
  ];

  const notesPanel = <div className="space-y-3">
    {canAttend ? <InternalNoteComposer id={order.id} /> : null}
    {notes.length ? <ol className="max-h-80 space-y-3 overflow-auto">
      {notes.map((note) => <li key={note.id} className="rounded-md bg-muted/40 p-3">
        <p className="whitespace-pre-wrap break-words text-sm leading-5">{note.content}</p>
        <p className="mt-1 text-xs text-muted-foreground">{note.author || "Gestor"} · {dateFormat.format(note.createdAt)}</p>
      </li>)}
    </ol> : <p className="text-sm text-muted-foreground">Todavía no hay notas internas.</p>}
  </div>;

  const historyPanel = activity.length ? <ol tabIndex={0} aria-label="Historial de atención" className="max-h-80 space-y-3 overflow-y-auto overscroll-contain">
    {activity.map((event) => (
      <li key={event.id} className="border-l border-border pl-3">
        <p className="text-sm leading-5">{event.detail.replace(/\s*\(revisión \d+\)\./gi, ".")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{dateFormat.format(event.createdAt)} · {event.actorName || "Sistema"}</p>
      </li>
    ))}
  </ol> : <p className="text-sm text-muted-foreground">Todavía no hay actividad registrada.</p>;

  return (
    <div className="min-w-0 space-y-5">
      <header className="space-y-3 border-b border-border pb-4">
        <Link href="/admin/pedidos" className={linkClass}><ArrowLeft aria-hidden="true" className="size-4" /> Pedidos</Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">Pedido {formatOrderNumber(order.orderNumber)}</h1>
              <StatusBadge status={order.orderStatus} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Registrado el {dateFormat.format(order.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/seguimiento/${order.trackingToken}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium hover:bg-secondary">
              Seguimiento <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
            <AuxiliaryPanels notes={notesPanel} history={historyPanel} notesCount={notes.length} historyCount={activity.length} />
            <OrderLiveRefresh finished={closed} />
          </div>
        </div>
        {cancelled && order.cancellationReason ? <p className="max-w-prose break-words text-sm leading-5 text-muted-foreground">Motivo de la cancelación: {order.cancellationReason}</p> : null}
      </header>
      <AttentionTabs current={current} progress={progress} outcome={cancelled ? "cancelled" : delivered ? "completed" : "active"} panels={panels} />
    </div>
  );
}
