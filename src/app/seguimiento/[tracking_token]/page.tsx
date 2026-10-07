import { CancelOrderControls } from "@/components/cancel-order-controls";
import { canBuyerCancel } from "@/lib/orders/cancellation-validation";
import { customerSaleDocuments } from "@/lib/orders/sale-documents";
import { DeliveryComplete } from "@/components/tracking/delivery-complete";
import { after } from "next/server";
import { needsOrderMailRecovery } from "@/lib/orders/mail-recovery";
import { deliverOrderEmail } from "@/lib/orders/email";
import { reportServerError } from "@/lib/server-diagnostics";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { customerTrackingUrl } from "@/lib/orders/customer-links";
import { getPublicOrigin } from "@/lib/payments/config";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, WalletCards } from "lucide-react";
import { getTrackedOrder } from "@/lib/orders/tracking";
import { getOrderBankAccounts, googleConfigured } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { ReceiptArea } from "@/components/tracking/controls";
import { ReceiptAcknowledgement } from "@/components/tracking/receipt-acknowledgement";
import { DeliveryCard } from "@/components/tracking/delivery-card";
import { CustomerProgress } from "@/components/tracking/order-progress";
import { OrderLiveRefresh } from "@/components/order-live-refresh";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const metadata: Metadata = { title: "Mi pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
const paymentLabels = { PENDIENTE: "Pendiente de comprobante", EN_REVISION: "En revisión", VERIFICADO: "Pago confirmado", RECHAZADO: "Adjunta otro comprobante", NO_APLICA: "No aplica" };
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });
export default async function TrackingPage({ params }: { params: Promise<{ tracking_token: string }> }) {
  const { tracking_token } = await params;
  const tracking = await getTrackedOrder(tracking_token);
  if (!tracking) notFound();
  const publicLink = customerTrackingUrl(tracking_token);
  if ((await headers()).get("sec-fetch-dest") === "document" && new URL(publicLink).origin !== getPublicOrigin()) redirect(publicLink);
  const { order, items, activity } = tracking;
  after(async () => {
    try { if (await needsOrderMailRecovery(order.id)) await deliverOrderEmail(order.trackingToken); }
    catch (error) { reportServerError("order.mail.recovery", error); }
  });
  const [banks, saleDocuments] = await Promise.all([getOrderBankAccounts(order.paymentAccounts), customerSaleDocuments(order.id)]);
  const closed = ["ENTREGADO", "CANCELADO"].includes(order.orderStatus);
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "NO_APLICA");
  const events = activity.filter((event, index) => index === 0 || event.detail !== activity[index - 1].detail);
  const paymentPanel = <section key="pago" aria-labelledby="payments-title" className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4"><h2 id="payments-title" className="flex items-center gap-3 text-sm font-semibold"><WalletCards className="size-5 text-primary" />Pagos y comprobantes</h2><Link href={`/seguimiento/${tracking_token}/guia`} className="text-xs font-semibold text-primary underline underline-offset-4">Guía de pago PDF</Link></div><div><p className="text-xs leading-6 text-muted-foreground">{order.orderStatus !== "PENDIENTE_PAGO" ? "Aquí puedes consultar los pagos y comprobantes de tu compra." : order.orderType === "mixto" ? "Son dos depósitos independientes, uno por cada sello. Adjunta el comprobante en su sección." : "Deposita en una de las cuentas indicadas y adjunta el comprobante."}</p><div className="mt-4 space-y-4">{applicable.map((imprint) => {
        const accounts = banks?.[imprint];
        const payment = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
        const reason = imprint === "universidad" ? order.rejectionUniversidad : order.rejectionInstituto;
        const amount = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
        const canUpload = order.orderStatus === "PENDIENTE_PAGO" && ["PENDIENTE", "RECHAZADO"].includes(payment);
        return <section key={imprint} className="overflow-hidden rounded-xl border border-border"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><ImprintBadge imprint={imprint} /><p className={`mt-2 text-xs font-medium ${payment === "RECHAZADO" ? "text-red-700" : payment === "VERIFICADO" ? "text-emerald-700" : "text-muted-foreground"}`}>{order.orderStatus === "CANCELADO" ? payment === "VERIFICADO" ? "Pago verificado antes de la anulación" : payment === "EN_REVISION" ? "Comprobante conservado" : "Pedido cancelado" : paymentLabels[payment]}</p></div><p className="text-xl font-semibold tabular-nums">{formatMoney(toCents(amount))}</p></div><div className="p-5">
          {payment === "VERIFICADO" ? <p className="flex gap-2 rounded-lg bg-emerald-50 p-3 text-xs leading-6 text-emerald-800"><CheckCircle2 className="mt-1 size-4 shrink-0" />Este pago ya está confirmado. No necesitas adjuntar más archivos para este sello.</p> : order.orderStatus === "CANCELADO" ? <p className="rounded-lg bg-muted p-3 text-xs leading-6">Este pedido fue cancelado. No realices nuevos depósitos.</p> : <>{reason ? <div className="mb-4 rounded-lg border border-red-100 bg-red-50 p-3 text-xs leading-6 text-red-700"><strong>Qué debes corregir</strong><p className="mt-1">{reason}</p></div> : null}{payment === "EN_REVISION" ? <ReceiptAcknowledgement imprint={imprint} /> : null}
          {payment !== "EN_REVISION" && accounts?.length ? <details open className="mb-5"><summary className="text-xs font-semibold">Cuentas para el depósito</summary><p className="mt-3 text-[11px] leading-5 text-muted-foreground">Elige una cuenta en soles{accounts.every((bank) => bank.holder === accounts[0].holder) ? ` · Titular: ${accounts[0].holder}` : ""}</p><div className="mt-3 grid gap-3 sm:grid-cols-2">{accounts.map((bank) => <div key={`${bank.bank}-${bank.account}`} className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs font-semibold">{bank.bank}</p>{!accounts.every((item) => item.holder === accounts[0].holder) ? <p className="mt-1 text-[10px] text-muted-foreground">{bank.holder}</p> : null}<dl className="mt-3 space-y-2 text-xs"><div><dt className="text-[10px] text-muted-foreground">Cuenta</dt><dd className="mt-1 break-all font-medium tabular-nums">{bank.account}</dd></div><div><dt className="text-[10px] text-muted-foreground">CCI</dt><dd className="mt-1 break-all font-medium tabular-nums">{bank.cci}</dd></div></dl></div>)}</div></details> : null}
          {canUpload ? <ReceiptArea token={tracking_token} imprint={imprint} enabled={googleConfigured()} /> : null}</>}

        </div></section>;
      })}</div></div>{saleDocuments.length ? <div className="border-t border-border pt-5"><h3 className="text-sm font-semibold">{order.billingRuc ? "Facturas de tu compra" : "Boletas de tu compra"}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Descarga los documentos emitidos por cada sello.</p><div className="mt-3 space-y-2">{saleDocuments.map((file) => <a key={file.id} download href={`/seguimiento/${tracking_token}/documentos/${file.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-xs font-medium text-primary hover:bg-secondary/30"><ImprintBadge imprint={file.imprint} /><span>Descargar PDF ↓</span></a>)}</div></div> : null}</section>;
  const distributionPanel = <div key="distribucion" className="space-y-4"><div><h2 className="text-base font-semibold">Distribución de tus publicaciones</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{order.orderStatus === "CANCELADO" ? "El pedido está cancelado y no continuará su distribución." : ["DESPACHADO", "ENTREGADO"].includes(order.orderStatus) ? order.deliveryType === "delivery" ? "El pedido ya fue enviado. Consulta aquí los datos del courier." : "Las publicaciones están disponibles para recoger en biblioteca." : "Te avisaremos cuando el pedido salga o esté listo para recoger."}</p></div><DeliveryCard order={order} /></div>;
  const deliveryPanel = order.orderStatus === "ENTREGADO" ? <DeliveryComplete key="entrega" deliveredAt={order.deliveredAt} /> : <section key="entrega" className="rounded-xl border border-border p-6"><h2 className="text-base font-semibold">{order.orderStatus === "CANCELADO" ? "Pedido cancelado" : "Confirmación de entrega"}</h2><p className="mt-3 text-sm leading-7 text-muted-foreground">{order.orderStatus === "CANCELADO" ? order.cancellationReason || "El pedido fue cancelado antes del despacho." : "Esta etapa se completará cuando recibas o recojas tus publicaciones. Te enviaremos la confirmación por correo."}</p></section>;
  return <main id="contenido" className="public-order-surface mx-auto w-full max-w-6xl px-5 py-7 sm:px-10 sm:py-10">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Mi pedido</p><h1 className="page-heading mt-2">Pedido {order.orderNumber}</h1><p className="mt-3 text-xs text-muted-foreground">Hola, {order.customerName}. Aquí encontrarás cada avance de tu compra.</p></div><div className="flex items-center gap-3"><p className="text-[10px] text-muted-foreground">Registrado {dateFormat.format(order.createdAt)}</p><OrderLiveRefresh finished={closed} /></div></div>
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]"><div className="space-y-6"><CustomerProgress key={order.orderStatus} order={{ orderStatus: order.orderStatus, deliveryType: order.deliveryType, paymentStatusUniversidad: order.paymentStatusUniversidad, paymentStatusInstituto: order.paymentStatusInstituto }} panels={[paymentPanel, distributionPanel, deliveryPanel]} /></div><aside className="space-y-5"><section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Detalle de tu compra</h2><ul className="mt-4 space-y-3">{items.map((item, index) => <li key={index} className="flex justify-between gap-3 text-xs"><div><p className="font-medium leading-5">{item.quantity} × {item.title}</p><p className="mt-1 text-[10px] text-muted-foreground">{formatMoney(toCents(item.unitPrice))} c/u</p></div><span className="shrink-0 tabular-nums">{formatMoney(toCents(item.subtotal))}</span></li>)}</ul><div className="mt-5 space-y-3 border-t border-border pt-4 text-xs"><div className="flex justify-between"><span>Publicaciones</span><span>{formatMoney(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))}</span></div>{Number(order.discountTotal) > 0 ? <div className="flex justify-between text-primary"><span>Descuento incluido</span><span>{formatMoney(toCents(order.discountTotal))}</span></div> : null}<div className="flex justify-between"><span>Costo por envío</span><span>{formatMoney(toCents(order.shippingCost))}</span></div><div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatMoney(toCents(order.total))}</span></div></div></section>

      {order.orderType === "mixto" ? <section className="rounded-xl border border-primary/15 bg-secondary/50 p-5"><h2 className="text-sm font-semibold">Desglose por cuenta</h2>{applicable.map((imprint) => <div key={imprint} className="mt-4 space-y-2"><ImprintBadge imprint={imprint} /><div className="flex justify-between text-xs text-muted-foreground"><span>Publicaciones</span><span>{formatMoney(toCents(imprint === "universidad" ? order.subtotalUniversidad : order.subtotalInstituto))}</span></div>{imprint === "universidad" ? <div className="flex justify-between text-xs text-muted-foreground"><span>Costo por envío</span><span>{formatMoney(toCents(order.shippingUniversidad))}</span></div> : null}<div className="flex justify-between text-xs font-semibold"><span>Total de la cuenta</span><span>{formatMoney(toCents(imprint === "universidad" ? order.totalUniversidad : order.totalInstituto))}</span></div></div>)}</section> : null}
      {canBuyerCancel(order) ? <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Gestionar pedido</h2><p className="mb-4 mt-2 text-xs leading-6 text-muted-foreground">Puedes cancelar antes de que se verifique un pago.</p><CancelOrderControls mode="comprador" reference={tracking_token} version={order.updatedAt.toISOString()} hasPayment={[order.paymentStatusUniversidad, order.paymentStatusInstituto].includes("EN_REVISION")} /></section> : null}
      <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Avances de tu pedido</h2><ol tabIndex={0} aria-label="Avances de tu pedido" className="mt-4 max-h-80 space-y-4 overflow-y-auto overscroll-contain pr-2 outline-none focus-visible:ring-2 focus-visible:ring-primary">{events.slice(0, 12).map((event, index) => <li key={index} className="border-l-2 border-primary/20 pl-4"><p className="text-xs leading-6">{event.detail}</p><p className="mt-1 text-[10px] text-muted-foreground">{dateFormat.format(event.createdAt)}</p></li>)}</ol>{!events.length ? <p className="mt-3 text-xs text-muted-foreground">Tu pedido está registrado. Mostraremos aquí sus avances.</p> : null}</section>
    </aside></div>
  </main>;
}
