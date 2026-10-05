import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { orderDetail } from "@/lib/admin/data";
import { requirePageAccess } from "@/lib/access";
import { formatMoney, toCents } from "@/lib/orders/money";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { DispatchControls, PaymentReview } from "@/components/admin/order-controls";

export const metadata: Metadata = { title: "Detalle del pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess();
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const detail = await orderDetail(parsed.data);
  if (!detail) notFound();
  const { order, items, receipts } = detail;
  const version = order.updatedAt.toISOString();
  return <>
    <Link href="/admin/pedidos" className="text-xs font-medium text-primary hover:underline">← Volver a pedidos</Link>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h1 className="page-heading">Pedido {order.orderNumber}</h1><p className="mt-3 text-xs text-muted-foreground">Registrado {dateFormat.format(order.createdAt)}</p></div><StatusBadge status={order.orderStatus} /></div>
    <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Publicaciones</h2><ul className="mt-3 divide-y divide-border">{items.map((item) => <li key={item.id} className="flex justify-between gap-4 py-4"><div><ImprintBadge imprint={item.imprint} /><p className="mt-2 text-sm font-medium">{item.quantity} × {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatMoney(toCents(item.price))} c/u</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(toCents(item.subtotal))}</p></li>)}</ul><dl className="space-y-3 border-t border-border pt-4 text-sm"><div className="flex justify-between"><dt>Publicaciones</dt><dd>{formatMoney(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))}</dd></div><div className="flex justify-between"><dt>Costo por envío</dt><dd>{formatMoney(toCents(order.shippingCost))}</dd></div><div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatMoney(toCents(order.total))}</dd></div></dl></section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Comprador</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">{[["Nombre", order.customerName], ["Correo", order.customerEmail], ["Teléfono", order.customerPhone], ["Documento", order.customerDocument], ["Tipo", order.customerType === "comunidad_continental" ? "Comunidad Continental" : "Público general"], ...(order.billingRuc ? [["RUC", order.billingRuc], ["Razón social", order.billingBusinessName ?? ""]] : [])].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl></section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">{order.deliveryType === "delivery" ? "Envío a domicilio" : "Recojo en biblioteca"}</h2><p className="mt-4 text-sm leading-6">{order.deliveryAddress}</p>{order.deliveryDistrict ? <p className="mt-2 text-xs text-muted-foreground">{order.deliveryDistrict}, {order.deliveryProvince}, {order.deliveryDepartment}</p> : null}{order.deliveryReference ? <p className="mt-2 text-xs leading-6">Referencia: {order.deliveryReference}</p> : null}<dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">{[["Persona que recibe / recoge", order.deliveryRecipient], ["Documento", order.deliveryRecipientDocument ?? order.customerDocument], ["Teléfono", order.deliveryRecipientPhone ?? order.customerPhone]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl>{order.courier ? <p className="mt-4 text-sm">Courier: {order.courier}</p> : null}{order.orderStatus === "EN_PREPARACION" || order.orderStatus === "DESPACHADO" ? <DispatchControls key={version} id={order.id} version={version} status={order.orderStatus} delivery={order.deliveryType === "delivery"} initialCourier={order.courier ?? ""} /> : <p className="mt-5 text-xs leading-6 text-muted-foreground">{order.orderStatus === "PENDIENTE_PAGO" ? "El despacho se habilita al verificar todos los pagos requeridos." : "No hay cambios de entrega pendientes."}</p>}</section>
      </div>
      <aside className="space-y-5">
        {(["universidad", "instituto"] as const).map((imprint) => {
          const status = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
          const total = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
          const files = receipts.filter((row) => row.publisherImprint === imprint);
          return <section key={imprint} className="rounded-xl border border-border p-5"><ImprintBadge imprint={imprint} /><div className="mt-4 flex flex-wrap items-center justify-between gap-2"><p className="text-xl font-semibold tabular-nums">{formatMoney(toCents(total))}</p><StatusBadge status={status} /></div>{files.length ? <ul className="mt-4 space-y-3">{files.map((file, index) => <li key={file.id} className="rounded-lg border border-border p-3"><a href={file.driveViewUrl} target="_blank" rel="noopener noreferrer" className="break-words text-xs font-medium text-primary underline underline-offset-4">{file.fileName}<span className="sr-only"> (abre Google Drive)</span></a><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{dateFormat.format(file.uploadedAt)}{index === 0 ? " · Más reciente" : " · Anterior"}</p></li>)}</ul> : <p className="mt-4 text-xs leading-6 text-muted-foreground">{status === "NO_APLICA" ? "Este pedido no requiere un depósito para este sello." : "Aún no hay comprobantes para este sello."}</p>}{status === "EN_REVISION" && files[0] && order.orderStatus === "PENDIENTE_PAGO" ? <PaymentReview key={version} id={order.id} version={version} imprint={imprint} receiptId={files[0].id} /> : null}</section>;
        })}
        <Link href={`/seguimiento/${order.trackingToken}`} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-primary underline underline-offset-4">Abrir seguimiento del comprador ↗</Link>
      </aside>
    </div>
  </>;
}
