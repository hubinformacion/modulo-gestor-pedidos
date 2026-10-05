import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrackedOrder } from "@/lib/orders/tracking";
import { getOrderBankAccounts, googleConfigured } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { imprintNames, type Imprint } from "@/lib/orders/types";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { ReceiptArea, TrackingControls } from "@/components/tracking/controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const metadata: Metadata = { title: "Seguimiento de pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
const orderLabels = { PENDIENTE_PAGO: "Pendiente de pago", EN_PREPARACION: "En preparación", DESPACHADO: "Despachado", ENTREGADO: "Entregado", CANCELADO: "Cancelado" };
const paymentLabels = { PENDIENTE: "Pendiente de comprobante", EN_REVISION: "Comprobante en revisión", VERIFICADO: "Pago verificado", RECHAZADO: "Comprobante rechazado · envía uno nuevo", NO_APLICA: "No aplica" };

export default async function TrackingPage({ params }: { params: Promise<{ tracking_token: string }> }) {
  const { tracking_token } = await params;
  const tracking = await getTrackedOrder(tracking_token);
  if (!tracking) notFound();
  const { order, items, receipts, emailStatus } = tracking;
  const banks = await getOrderBankAccounts(order.paymentAccounts);
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "NO_APLICA");
  const writable: Imprint[] = order.orderStatus === "PENDIENTE_PAGO" ? applicable.filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "VERIFICADO") : [];
  return <main id="contenido" className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-12">
    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Seguimiento</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="page-heading">Pedido {order.orderNumber}</h1><span className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-primary">{orderLabels[order.orderStatus]}</span></div>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">Tu pedido está registrado. Conserva este enlace para consultar su estado y adjuntar tus comprobantes.</p>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{emailStatus === "ENVIADO" ? "La confirmación se envió a" : emailStatus === "ERROR" ? "No se pudo enviar la confirmación a" : "La confirmación está pendiente de envío a"} <strong>{order.customerEmail}</strong>. Tu pedido permanece guardado.</p>
    <div className="mt-5"><TrackingControls token={tracking_token} retryEmail={emailStatus !== "ENVIADO"} /></div>
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Publicaciones</h2><ul className="mt-4 divide-y divide-border">{items.map((item, index) => <li key={index} className="flex justify-between gap-4 py-4"><div><ImprintBadge imprint={item.publisherImprint} /><p className="mt-2 text-sm font-medium">{item.quantity} × {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatMoney(toCents(item.unitPrice))} c/u</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(toCents(item.subtotal))}</p></li>)}</ul></section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Entrega</h2><p className="mt-4 text-sm">{order.deliveryType === "recojo_campus" ? "Recojo en biblioteca" : "Envío a domicilio"}</p><p className="mt-2 text-sm leading-6">{order.deliveryAddress}</p>{order.deliveryDistrict ? <p className="mt-1 text-xs text-muted-foreground">{order.deliveryDistrict}, {order.deliveryProvince}, {order.deliveryDepartment}</p> : null}{order.deliveryReference ? <p className="mt-2 text-xs">Referencia: {order.deliveryReference}</p> : null}<p className="mt-3 text-xs leading-6">{order.deliveryType === "recojo_campus" ? "Recoge" : "Recibe"}: {order.deliveryRecipient} · {order.deliveryRecipientPhone}</p>{order.courier ? <p className="mt-3 text-sm">Courier: {order.courier}</p> : null}</section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Comprobantes de pago</h2>
          {writable.length ? <div className="mt-4"><ReceiptArea token={tracking_token} writable={writable} enabled={googleConfigured()} /></div> : <p className="mt-3 text-sm leading-6 text-muted-foreground">{order.orderStatus === "CANCELADO" ? "Este pedido fue cancelado." : "Los pagos requeridos están verificados. No necesitas enviar más comprobantes."}</p>}
          {receipts.length ? <ul className="mt-5 space-y-3 border-t border-border pt-5">{receipts.map((receipt) => <li key={receipt.id} className="text-xs leading-6"><strong>{imprintNames[receipt.publisherImprint]}</strong> · {receipt.fileName}<span className="block text-muted-foreground">Recibido {receipt.uploadedAt.toLocaleString("es-PE", { timeZone: "America/Lima" })}</span></li>)}</ul> : null}
        </section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-6">
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Detalle de pago</h2><div className="mt-4 flex justify-between text-xs"><span>Publicaciones</span><span>{formatMoney(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))}</span></div><div className="mt-3 flex justify-between text-xs"><span>Envío</span><span>{formatMoney(toCents(order.shippingCost))}</span></div><div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold"><span>Total</span><span>{formatMoney(toCents(order.total))}</span></div><Link href={`/seguimiento/${tracking_token}/guia`} className="mt-5 inline-block text-xs font-semibold text-primary underline underline-offset-4">Descargar guía de pago PDF</Link></section>
        {applicable.map((imprint) => {
          const accounts = banks?.[imprint];
          const total = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
          const payment = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
          return <section key={imprint} className="rounded-xl border border-border p-5"><ImprintBadge imprint={imprint} /><p className="mt-3 text-xl font-semibold tabular-nums">{formatMoney(toCents(total))}</p><p className="mt-2 text-xs font-medium text-primary">{paymentLabels[payment]}</p>{accounts ? <div className="mt-4"><p className="text-xs leading-6 text-muted-foreground">Elige una cuenta para el depósito de este sello.</p>{accounts.map((bank) => <dl key={bank.bank} className="mt-4 space-y-3 border-t border-border pt-4 text-xs"><div><dt className="text-muted-foreground">Banco · cuenta en soles</dt><dd className="mt-1 font-medium">{bank.bank}</dd></div><div><dt className="text-muted-foreground">Titular</dt><dd className="mt-1">{bank.holder}</dd></div><div><dt className="text-muted-foreground">Cuenta</dt><dd className="mt-1 break-all font-medium">{bank.account}</dd></div><div><dt className="text-muted-foreground">CCI</dt><dd className="mt-1 break-all font-medium">{bank.cci}</dd></div></dl>)}</div> : <p className="mt-3 text-xs text-muted-foreground">Consulta la guía para los datos de pago.</p>}</section>;
        })}
        {order.orderType === "mixto" ? <p className="text-xs leading-6 text-muted-foreground">Realiza dos depósitos independientes. El envío está incluido únicamente en Universidad Continental.</p> : null}
      </aside>
    </div>
  </main>;
}
