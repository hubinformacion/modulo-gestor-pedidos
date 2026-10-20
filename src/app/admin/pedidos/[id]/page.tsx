import { asc, eq } from "drizzle-orm";
import { withReadDatabase } from "@/db";
import { pickupContacts, pickupNotifications } from "@/db/schema";
import { canAttendOrders } from "@/lib/access-policy";
import { PurchaseDetail } from "@/components/orders/purchase-detail";
import { DetailCardHeading } from "@/components/workspace/detail-card-heading";
import { formatOrderNumber } from "@/lib/orders/number";
import { AuxiliaryPanels } from "@/components/workspace/auxiliary-panels";
import { CancelOrderControls } from "@/components/cancel-order-controls";
import { AdminSaleDocuments } from "@/components/caja/admin-documents";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { UserRound, FileText, Truck, CheckCircle2, Circle, LockKeyhole, BookOpen, UserRoundCheck, ClipboardCheck, PackageCheck, Send, CreditCard, ChevronDown, ArrowUpRight } from "lucide-react";
import { orderDetail } from "@/lib/admin/data";
import { requirePageAccess } from "@/lib/access";
import { formatMoney, toCents, centsToDecimal } from "@/lib/orders/money";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { AssignmentControls, DispatchControls, PaymentReview } from "@/components/admin/order-controls";
import { InternalNoteComposer } from "@/components/admin/internal-note-composer";
import { AttentionTabs } from "@/components/admin/attention-tabs";
import { OrderLiveRefresh } from "@/components/order-live-refresh";

export const metadata: Metadata = { title: "Atención del pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
export const maxDuration = 180;
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageAccess();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const detail = await orderDetail(parsed.data);
  if (!detail) notFound();
  const { order, items, receipts, activity, notes, evidence } = detail;
  const [supportContacts, supportNotices] = await withReadDatabase((db) => Promise.all([
    db.select({ id: pickupContacts.id, name: pickupContacts.name }).from(pickupContacts).where(eq(pickupContacts.status, "ACTIVO")).orderBy(asc(pickupContacts.name)),
    db.select({ status: pickupNotifications.status, createdAt: pickupNotifications.createdAt }).from(pickupNotifications).where(eq(pickupNotifications.orderId, order.id)),
  ]));
  const version = order.updatedAt.toISOString();
  const closed = ["ENTREGADO", "CANCELADO"].includes(order.orderStatus);
  const canAttend = canAttendOrders(actor);
  const mine = canAttend && order.assignedTo === actor.userId;
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "NO_APLICA");
  const current = !order.assignedTo && !closed ? 0 : order.orderStatus === "PENDIENTE_PAGO" ? 1 : order.orderStatus === "EN_PREPARACION" ? 2 : 3;
  const deliveryDetails = <div className="rounded-lg border border-border p-4">
    <DetailCardHeading level={3} icon={Truck} title={order.deliveryType === "delivery" ? "Entrega a domicilio" : "Recojo en biblioteca"} />
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="min-w-0"><h4 className="text-[10px] font-semibold text-primary">{order.deliveryType === "delivery" ? "Destino de entrega" : "Lugar de recojo"}</h4><p className="mt-2 break-words text-xs leading-6">{order.deliveryAddress}</p>
        {order.deliveryType === "recojo_campus" && order.deliveryPickupHours ? <p className="mt-1 text-xs leading-6">{order.deliveryPickupHours}</p> : null}{order.pickupContactName ? <p className="mt-2 text-xs leading-6"><strong>Apoyo:</strong> {order.pickupContactName}{order.pickupContactEmail ? ` · ${order.pickupContactEmail}` : ""}<span className="block text-muted-foreground">Aviso al apoyo: {supportNotices[0]?.status === "ENVIADO" ? "Enviado" : supportNotices[0]?.status === "ERROR" ? "No se pudo enviar" : supportNotices[0]?.status === "OMITIDO" ? "Omitido" : "Registrado"}</span></p> : null}{order.deliveryType === "recojo_campus" && order.deliveryLibraryLocation ? <p className="mt-1 text-xs font-medium text-primary">{order.deliveryLibraryLocation}</p> : null}
        {order.deliveryDistrict ? <p className="mt-2 text-[10px] leading-5 text-muted-foreground">{order.deliveryDistrict}, {order.deliveryProvince}, {order.deliveryDepartment}</p> : null}
        {order.deliveryReference ? <p className="mt-2 text-[10px] leading-5 text-muted-foreground">Referencia: {order.deliveryReference}</p> : null}
        {order.deliveryMapUrl ? <a href={order.deliveryMapUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-[10px] font-medium text-primary underline">Ver ubicación en Google Maps ↗</a> : null}
      </div>
      <div className="min-w-0 border-t border-border pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><h4 className="text-[10px] font-semibold text-primary">{order.deliveryType === "delivery" ? "Persona que recibe" : "Persona que recoge"}</h4><dl className="mt-3 space-y-3 text-xs">{[["Nombre completo", order.deliveryRecipient], ["Documento", order.deliveryRecipientDocument ?? order.customerDocument], ["Celular", order.deliveryRecipientPhone ?? order.customerPhone]].map(([label, value]) => <div key={label}><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium leading-5">{value}</dd></div>)}</dl></div>
    </div>
  </div>;
  const packingList = <div className="rounded-lg border border-border p-4"><DetailCardHeading level={3} icon={BookOpen} title="Publicaciones a preparar" /><ul className="mt-3 divide-y divide-border">{items.map((item) => <li key={item.id} className="flex items-start gap-3 py-2 text-xs"><span className="rounded bg-secondary px-2 py-1 font-semibold tabular-nums text-primary">{item.quantity}</span><div><p className="font-medium leading-5">{item.title}</p><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-[10px] text-muted-foreground">{item.code || "Sin código"}</span><ImprintBadge imprint={item.imprint} /></div></div></li>)}</ul></div>;
  const buyerCard = <section className="rounded-xl border border-border p-6"><DetailCardHeading icon={UserRound} title="Datos del comprador" aside={<span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">{order.customerType === "comunidad_continental" ? "Comunidad Continental" : "Público general"}</span>} /><dl className="grid gap-5 text-xs sm:grid-cols-2">{[["Nombre completo", order.customerName], ["Documento", order.customerDocument], ["Correo electrónico", order.customerEmail], ["Celular", order.customerPhone]].map(([label, value]) => <div key={label}><dt className="text-[10px] text-muted-foreground">{label}</dt><dd className="mt-2 break-words font-medium leading-6">{value}</dd></div>)}</dl>{order.billingRuc ? <details className="group mt-5 rounded-lg border border-border bg-muted/20 text-xs leading-6"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 font-semibold"><span>Facturación registrada en la compra</span><ChevronDown className="size-4 shrink-0 text-muted-foreground group-open:rotate-180" aria-hidden="true" /></summary><div className="border-t border-border px-4 pb-4 pt-3"><p className="font-medium">{order.billingBusinessName}</p><p>RUC {order.billingRuc}</p><p className="mt-1">{order.billingAddress || "Sin dirección fiscal registrada"}</p></div></details> : null}</section>;
  const purchaseCard = <PurchaseDetail items={items} subtotal={centsToDecimal(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))} shipping={order.shippingCost} total={order.total} discountTotal={order.discountTotal} couponCode={order.couponCode} />;
  const panels = [
    <div key="attention" className="space-y-4">
      <div><h2 className="text-base font-semibold">Revisión inicial</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">Comprueba los datos y toma la atención del pedido.</p></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section className="rounded-lg border border-border p-4">
          <DetailCardHeading level={3} icon={UserRoundCheck} title="Responsable" aside={<Link href={`/seguimiento/${order.trackingToken}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-primary/15 bg-secondary px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Ver seguimiento del comprador<ArrowUpRight className="size-3 shrink-0" aria-hidden="true" /></Link>} />
          <p className="mt-3 text-sm font-medium">{order.assignedName || "Pedido disponible"}</p>
          {order.assignedAt ? <p className="mt-1 text-[10px] text-muted-foreground">Asignado {dateFormat.format(order.assignedAt)}</p> : null}
          <div className="mt-4 flex flex-wrap items-start gap-2">{canAttend ? <AssignmentControls id={order.id} version={version} assigned={Boolean(order.assignedTo)} mine={mine} closed={closed} /> : <p className="text-xs leading-6 text-muted-foreground">Cuenta maestra · Solo consulta de pedidos. La atención requiere una cuenta personal autorizada.</p>}{mine && ["PENDIENTE_PAGO", "EN_PREPARACION"].includes(order.orderStatus) ? <CancelOrderControls mode="gestor" reference={order.id} version={version} hasPayment={receipts.length > 0} /> : null}</div>

        </section>
        <section className="rounded-lg border border-border bg-muted/10 p-4"><DetailCardHeading level={3} icon={ClipboardCheck} title="Estado de la revisión" /><ul className="mt-3 space-y-3 text-xs">{applicable.map((imprint) => { const verified = (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) === "VERIFICADO"; const Icon = verified ? CheckCircle2 : Circle; return <li key={imprint} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><Icon className={`size-4 ${verified ? "text-emerald-600" : "text-muted-foreground"}`} />{imprint === "universidad" ? "Universidad" : "Instituto"}</span><StatusBadge status={imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto} /></li>; })}<li className="flex items-center justify-between gap-2 border-t border-border pt-3"><span>Modalidad</span><strong className="font-medium">{order.deliveryType === "delivery" ? "Domicilio" : "Recojo"}</strong></li></ul></section>
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">{buyerCard}{purchaseCard}</div>
    </div>,
    <div key="payments"><h2 className="text-base font-semibold">Revisión de comprobantes</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">Verifica cada depósito antes de preparar las publicaciones.</p>
      <div className={`mt-4 grid items-start gap-3 ${applicable.length > 1 ? "xl:grid-cols-2" : ""}`}>{applicable.map((imprint) => {
        const status = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
        const amount = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
        const files = receipts.filter((file) => file.publisherImprint === imprint);
        const reason = imprint === "universidad" ? order.rejectionUniversidad : order.rejectionInstituto;
        const receiptLink = (file: (typeof files)[number], latest: boolean) => <li key={file.id} className="flex items-start gap-2 rounded-md bg-muted/30 p-2.5"><FileText className="mt-1 size-4 shrink-0 text-primary" /><div className="min-w-0"><a href={file.driveViewUrl} target="_blank" rel="noopener noreferrer" className="break-words text-xs font-medium text-primary underline underline-offset-4">{file.fileName}</a><p className="mt-1 text-[10px] leading-5 text-muted-foreground">{dateFormat.format(file.uploadedAt)}{latest ? " · Más reciente" : ""}</p></div></li>;
        return <section key={imprint} className="rounded-lg border border-border p-4"><DetailCardHeading icon={CreditCard} title="Comprobante de pago" aside={<StatusBadge status={status} />} /><ImprintBadge imprint={imprint} /><div className="my-3 flex items-baseline justify-between border-b border-border pb-3"><span className="text-[10px] text-muted-foreground">Importe a verificar</span><strong className="text-xl font-semibold tabular-nums">{formatMoney(toCents(amount))}</strong></div>
          {files[0] ? <><ul>{receiptLink(files[0], true)}</ul>{files.length > 1 ? <details className="mt-2"><summary className="cursor-pointer text-[10px] font-medium text-muted-foreground">Otros comprobantes ({files.length - 1})</summary><ul className="mt-2 space-y-2">{files.slice(1).map((file) => receiptLink(file, false))}</ul></details> : null}</> : <p className="rounded-md bg-muted/20 p-3 text-xs leading-6 text-muted-foreground">Sin comprobante adjunto.</p>}
          {reason ? <p className="mt-3 rounded-md bg-red-50 p-3 text-xs leading-6 text-red-700">Motivo: {reason}</p> : null}
          {mine && status === "EN_REVISION" && files[0] && order.orderStatus === "PENDIENTE_PAGO" ? <PaymentReview id={order.id} version={version} imprint={imprint} receiptId={files[0].id} /> : null}
        </section>;
      })}</div>{!mine && !closed ? <p className="mt-3 text-[10px] leading-6 text-muted-foreground">Las decisiones de pago las registra el gestor asignado.</p> : null}<div className="mt-5"><AdminSaleDocuments orderId={order.id} invoice={Boolean(order.billingRuc)} canReturn={mine && order.orderStatus !== "CANCELADO"} /></div>
    </div>,
    <div key="preparation"><h2 className="text-base font-semibold">Distribución y despacho</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">Comprueba cantidades y destino antes de registrar la salida.</p><div className="mt-5 grid items-start gap-5 xl:grid-cols-2">{packingList}{deliveryDetails}</div>
      {mine && order.orderStatus === "EN_PREPARACION" ? <section className="mt-4 rounded-lg border border-primary/15 bg-secondary/10 p-4"><DetailCardHeading level={3} icon={Send} title="Registrar salida" /><DispatchControls id={order.id} version={version} status="EN_PREPARACION" supportContacts={supportContacts} delivery={order.deliveryType === "delivery"} initialCourier={order.courier ?? ""} initialCode={order.shippingTrackingCode ?? ""} initialUrl={order.shippingTrackingUrl ?? ""} /></section> : <p className="mt-3 text-xs leading-6 text-muted-foreground">{order.orderStatus === "PENDIENTE_PAGO" ? "La salida se habilita al verificar todos los pagos." : "Consulta la entrega en la última etapa."}</p>}
    </div>,
    <div key="delivery"><h2 className="text-base font-semibold">{closed ? "Cierre de atención" : "Entrega y seguimiento"}</h2><div className="mt-5 grid items-start gap-5 xl:grid-cols-2">{deliveryDetails}<section className="rounded-lg border border-border p-4"><DetailCardHeading level={3} icon={PackageCheck} title="Registro de entrega" /><dl className="mt-3 space-y-3 text-xs">
      {order.courier ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Courier</dt><dd className="font-medium">{order.courier}</dd></div> : null}
      {order.shippingTrackingCode ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Guía</dt><dd className="break-all font-medium">{order.shippingTrackingCode}</dd></div> : null}
      {order.dispatchedAt ? <div><dt className="text-muted-foreground">Salida / disponibilidad</dt><dd className="mt-1 font-medium">{dateFormat.format(order.dispatchedAt)}</dd></div> : null}
      {order.deliveredAt ? <div className="rounded-md bg-emerald-50 p-3 text-emerald-800"><dt>Entrega confirmada</dt><dd className="mt-1 font-medium">{dateFormat.format(order.deliveredAt)}</dd></div> : null}
      </dl>{order.shippingTrackingUrl ? <a href={order.shippingTrackingUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-xs font-semibold text-primary underline">Consultar envío ↗</a> : null}
      {mine && order.orderStatus === "DESPACHADO" ? <DispatchControls id={order.id} version={version} status="DESPACHADO" existingEvidenceId={evidence[0]?.id ?? null} delivery={order.deliveryType === "delivery"} initialCourier={order.courier ?? ""} /> : !closed && order.orderStatus !== "DESPACHADO" ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Pendiente de registrar salida o disponibilidad.</p> : null}
      {evidence.length ? <div className="mt-3 border-t border-border pt-3"><h4 className="text-xs font-semibold">{order.deliveryType === "delivery" ? "Evidencia de entrega del courier" : "Evidencia del recojo"}</h4>{evidence.map((file) => <div key={file.id} className="mt-2"><a href={file.driveViewUrl!} target="_blank" rel="noopener noreferrer" className="break-all text-xs font-medium text-primary underline">{file.fileName}</a><p className="mt-1 text-[10px] text-muted-foreground">{file.actorName} · {dateFormat.format(file.confirmedAt ?? file.uploadedAt!)}</p></div>)}</div> : null}
      {order.orderStatus === "CANCELADO" ? <p className="mt-3 text-xs text-muted-foreground">Este pedido está cancelado.{order.cancellationReason ? ` Motivo: ${order.cancellationReason}` : ""}</p> : null}
      </section></div>
    </div>,
  ];
  const notesPanel = <section className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><LockKeyhole className="size-3" />Solo para el equipo</span></div>{canAttend ? <InternalNoteComposer id={order.id} /> : null}{notes.length ? <ol className="mt-4 max-h-80 space-y-3 overflow-y-auto border-t border-border pt-4">{notes.map((note) => <li key={note.id} className="rounded-lg bg-muted/30 p-3"><p className="whitespace-pre-wrap break-words text-xs leading-6">{note.content}</p><p className="mt-2 text-[10px] text-muted-foreground">{note.author || "Gestor"} · {dateFormat.format(note.createdAt)}</p></li>)}</ol> : null}</section>;
  const historyPanel = <section className="min-w-0"><ol tabIndex={0} aria-label="Historial de atención" className="mt-4 max-h-80 space-y-4 overflow-y-auto overscroll-contain pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary">{activity.map((event) => <li key={event.id} className="border-l-2 border-primary/20 pl-4"><p className="text-xs leading-6">{event.detail.replace(/\s*\(revisión \d+\)\./gi, ".")}</p><p className="mt-1 text-[10px] text-muted-foreground">{dateFormat.format(event.createdAt)} · {event.actorName || "Sistema"}</p></li>)}</ol>{!activity.length ? <p className="mt-3 text-xs text-muted-foreground">Los avances de atención quedarán registrados aquí.</p> : null}</section>;
  return <><Link href="/admin/pedidos" className="text-xs font-medium text-primary hover:underline">← Volver a la bandeja</Link><div className="mt-5 flex flex-wrap items-start justify-between gap-4"><div><h1 className="page-heading">Pedido {formatOrderNumber(order.orderNumber)}</h1><p className="mt-3 text-xs text-muted-foreground">Registrado {dateFormat.format(order.createdAt)}</p><p className="mt-3 flex items-center gap-2 text-xs"><UserRound className="size-4 text-primary" />{order.assignedName ? `Gestor: ${order.assignedName}` : "Sin gestor asignado"}</p></div><div className="flex max-w-full flex-wrap items-center justify-end gap-2"><StatusBadge status={order.orderStatus} /><AuxiliaryPanels notes={notesPanel} history={historyPanel} notesCount={notes.length} historyCount={activity.length} /><OrderLiveRefresh finished={closed} /></div></div><div className="mt-6 space-y-6"><AttentionTabs current={current} panels={panels} /></div></>;
}
