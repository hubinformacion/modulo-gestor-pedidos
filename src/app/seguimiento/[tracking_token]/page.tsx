import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTrackedOrder } from "@/lib/orders/tracking";
import { getOrderBankAccounts, googleConfigured } from "@/lib/payments/config";
import { formatMoney, toCents } from "@/lib/orders/money";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { ReceiptArea, TrackingControls } from "@/components/tracking/controls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
export const metadata: Metadata = { title: "Seguimiento de pedido", referrer: "no-referrer", robots: { index: false, follow: false } };
const orderLabels = { PENDIENTE_PAGO: "Pendiente de pago", EN_PREPARACION: "En preparación", DESPACHADO: "Despachado", ENTREGADO: "Entregado", CANCELADO: "Cancelado" };
const paymentLabels = { PENDIENTE: "Pendiente de comprobante", EN_REVISION: "Comprobantes en revisión", VERIFICADO: "Pago verificado", RECHAZADO: "Comprobante rechazado · adjunta uno nuevo", NO_APLICA: "No aplica" };

export default async function TrackingPage({ params }: { params: Promise<{ tracking_token: string }> }) {
  const { tracking_token } = await params;
  const tracking = await getTrackedOrder(tracking_token);
  if (!tracking) notFound();
  const { order, items, receipts, emailStatus } = tracking;
  const banks = await getOrderBankAccounts(order.paymentAccounts);
  const applicable = (["universidad", "instituto"] as const).filter((imprint) => (imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto) !== "NO_APLICA");
  return <main id="contenido" className="mx-auto max-w-6xl px-5 py-8 sm:px-10 sm:py-12">
    <p className="text-xs font-semibold uppercase tracking-wider text-primary">Seguimiento</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-4"><h1 className="page-heading">Pedido {order.orderNumber}</h1><span className="rounded-lg bg-secondary px-3 py-2 text-xs font-semibold text-primary">{orderLabels[order.orderStatus]}</span></div>
    <p className="mt-4 text-sm leading-6 text-muted-foreground">Tu pedido está registrado. Conserva este enlace para consultar su estado y adjuntar tus comprobantes.</p>
    <p className="mt-2 text-xs leading-6 text-muted-foreground">{emailStatus === "ENVIADO" ? "La confirmación se envió a" : emailStatus === "ERROR" ? "No se pudo enviar la confirmación a" : "La confirmación está pendiente de envío a"} <strong>{order.customerEmail}</strong>.</p>
    {emailStatus !== "ENVIADO" || tracking.hasPendingNotifications ? <div className="mt-3"><TrackingControls token={tracking_token} retryEmail /></div> : null}
    <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section aria-labelledby="payments-title"><h2 id="payments-title" className="text-base font-semibold">Pago y comprobantes</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{order.orderType === "mixto" ? "Realiza dos depósitos independientes. Adjunta y confirma el comprobante en el sello que corresponda." : "Deposita el importe en una de las cuentas y adjunta tu comprobante."}</p>
          <div className="mt-4 space-y-5">{applicable.map((imprint) => {
            const accounts = banks?.[imprint];
            const payment = imprint === "universidad" ? order.paymentStatusUniversidad : order.paymentStatusInstituto;
            const total = imprint === "universidad" ? order.totalUniversidad : order.totalInstituto;
            const canUpload = order.orderStatus === "PENDIENTE_PAGO" && (payment === "PENDIENTE" || payment === "RECHAZADO");
            const files = receipts.filter((file) => file.publisherImprint === imprint);
            return <section key={imprint} className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><ImprintBadge imprint={imprint} /><p className="mt-2 text-xs font-medium text-muted-foreground">{paymentLabels[payment]}</p></div><div className="text-right"><p className="text-[11px] text-muted-foreground">Importe a depositar</p><p className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(toCents(total))}</p></div></div>
              <div className="p-5">
                {accounts?.length ? <><p className="text-xs font-medium">Elige una cuenta en soles</p>{accounts.every((bank) => bank.holder === accounts[0].holder) ? <p className="mt-1 text-xs leading-5 text-muted-foreground">Titular: {accounts[0].holder}</p> : null}<div className="mt-3 grid gap-3 sm:grid-cols-2">{accounts.map((bank) => <div key={`${bank.bank}-${bank.account}`} className="rounded-lg border border-border bg-muted/20 p-3"><p className="text-xs font-semibold">{bank.bank}</p>{bank.holder !== accounts[0].holder || !accounts.every((item) => item.holder === accounts[0].holder) ? <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{bank.holder}</p> : null}<dl className="mt-3 space-y-2 text-xs"><div><dt className="text-[10px] text-muted-foreground">Cuenta</dt><dd className="mt-1 break-all font-medium tabular-nums">{bank.account}</dd></div><div><dt className="text-[10px] text-muted-foreground">CCI</dt><dd className="mt-1 break-all font-medium tabular-nums">{bank.cci}</dd></div></dl></div>)}</div></> : <p className="text-xs text-muted-foreground">Consulta los datos bancarios en la guía de pago.</p>}
                <div className="mt-5 border-t border-border pt-5">{canUpload ? <ReceiptArea token={tracking_token} imprint={imprint} enabled={googleConfigured()} hasUnconfirmedReceipt={imprint === "universidad" ? tracking.hasNewUniversidadReceipt : tracking.hasNewInstitutoReceipt} /> : <p className="text-xs leading-6 text-muted-foreground">{order.orderStatus === "CANCELADO" ? "Este pedido fue cancelado." : payment === "EN_REVISION" ? "El equipo está revisando los comprobantes de este sello. Te avisaremos por correo." : "Este pago ya está verificado."}</p>}</div>
                {files.length ? <details className="mt-4 rounded-lg bg-muted/40 px-3 py-2"><summary className="text-xs font-medium">Archivos cargados ({files.length})</summary><ul className="mt-2 divide-y divide-border">{files.map((file) => <li key={file.id} className="py-2 text-xs leading-5"><p className="break-words">{file.fileName}</p><p className="text-[10px] text-muted-foreground">{file.uploadedAt.toLocaleString("es-PE", { timeZone: "America/Lima" })}</p></li>)}</ul></details> : null}
              </div>
            </section>;
          })}</div>
        </section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Publicaciones</h2><ul className="mt-4 divide-y divide-border">{items.map((item, index) => <li key={index} className="flex justify-between gap-4 py-4"><div><ImprintBadge imprint={item.publisherImprint} /><p className="mt-2 text-sm font-medium">{item.quantity} × {item.title}</p><p className="mt-1 text-xs text-muted-foreground">{formatMoney(toCents(item.unitPrice))} c/u</p></div><p className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(toCents(item.subtotal))}</p></li>)}</ul></section>
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Entrega</h2><p className="mt-4 text-sm">{order.deliveryType === "recojo_campus" ? "Recojo en biblioteca" : "Envío a domicilio"}</p><p className="mt-2 text-sm leading-6">{order.deliveryAddress}</p>{order.deliveryDistrict ? <p className="mt-1 text-xs text-muted-foreground">{order.deliveryDistrict}, {order.deliveryProvince}, {order.deliveryDepartment}</p> : null}{order.deliveryReference ? <p className="mt-2 text-xs">Referencia: {order.deliveryReference}</p> : null}<p className="mt-3 text-xs leading-6">{order.deliveryType === "recojo_campus" ? "Recoge" : "Recibe"}: {order.deliveryRecipient} · {order.deliveryRecipientPhone}</p>{order.courier ? <p className="mt-3 text-sm">Courier: {order.courier}</p> : null}</section>
      </div>
      <aside className="space-y-5 lg:sticky lg:top-6">
        <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Detalle del pedido</h2><div className="mt-4 flex justify-between text-xs"><span>Publicaciones</span><span>{formatMoney(toCents(order.subtotalUniversidad) + toCents(order.subtotalInstituto))}</span></div><div className="mt-3 flex justify-between text-xs"><span>Costo por envío</span><span>{formatMoney(toCents(order.shippingCost))}</span></div><div className="mt-4 flex justify-between border-t border-border pt-4 font-semibold"><span>Total</span><span>{formatMoney(toCents(order.total))}</span></div><Link href={`/seguimiento/${tracking_token}/guia`} className="mt-5 inline-block text-xs font-semibold text-primary underline underline-offset-4">Descargar guía de pago PDF</Link></section>
        {order.orderType === "mixto" ? <section className="rounded-xl border border-border p-5"><h2 className="text-sm font-semibold">Desglose por cuenta</h2>{applicable.map((imprint) => <div key={imprint} className="mt-4 space-y-2"><ImprintBadge imprint={imprint} /><div className="flex justify-between text-xs text-muted-foreground"><span>Publicaciones</span><span>{formatMoney(toCents(imprint === "universidad" ? order.subtotalUniversidad : order.subtotalInstituto))}</span></div>{imprint === "universidad" ? <div className="flex justify-between text-xs text-muted-foreground"><span>Costo por envío</span><span>{formatMoney(toCents(order.shippingUniversidad))}</span></div> : null}<div className="flex justify-between text-xs font-semibold"><span>Total de la cuenta</span><span>{formatMoney(toCents(imprint === "universidad" ? order.totalUniversidad : order.totalInstituto))}</span></div></div>)}<p className="mt-4 text-xs leading-6 text-muted-foreground">El costo por envío corresponde únicamente a Universidad Continental.</p></section> : null}
      </aside>
    </div>
  </main>;
}
