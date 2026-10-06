import { ArrowUpRight, MapPin, PackageCheck, Truck } from "lucide-react";
import type { orders } from "@/db/schema";

type DeliveryOrder = Pick<typeof orders.$inferSelect, "orderStatus" | "deliveryType" | "deliveryAddress" | "deliveryDistrict" | "deliveryProvince" | "deliveryDepartment" | "deliveryReference" | "deliveryRecipient" | "deliveryRecipientPhone" | "courier" | "shippingTrackingCode" | "shippingTrackingUrl" | "dispatchedAt" | "deliveredAt">;
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Lima" });

export function DeliveryCard({ order }: { order: DeliveryOrder }) {
  const pickup = order.deliveryType === "recojo_campus";
  const sent = ["DESPACHADO", "ENTREGADO"].includes(order.orderStatus);
  const delivered = order.orderStatus === "ENTREGADO";
  const status = delivered ? "Entregado" : order.orderStatus === "CANCELADO" ? "Cancelado" : sent ? pickup ? "Disponible para recojo" : "En camino" : "Pendiente de preparación";
  const Icon = delivered ? PackageCheck : pickup ? MapPin : Truck;
  return <section className="overflow-hidden rounded-2xl border border-border bg-white">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
      <h2 className="flex items-center gap-3 text-sm font-semibold"><Icon className="size-5 text-primary" />{pickup ? "Recojo en biblioteca" : "Entrega a domicilio"}</h2>
      <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${delivered ? "bg-emerald-50 text-emerald-700" : "bg-secondary/60 text-primary"}`}>{status}</span>
    </div>
    <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pickup ? "Biblioteca" : "Dirección de entrega"}</p><p className="mt-2 text-sm font-medium leading-6">{order.deliveryAddress}</p>
        {order.deliveryDistrict ? <p className="mt-1 text-xs leading-6 text-muted-foreground">{order.deliveryDistrict}, {order.deliveryProvince}, {order.deliveryDepartment}</p> : null}
        {order.deliveryReference ? <p className="mt-2 text-xs leading-6 text-muted-foreground">Referencia: {order.deliveryReference}</p> : null}
      </div>
      <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{pickup ? "Persona que recoge" : "Persona que recibe"}</p><p className="mt-2 text-sm font-medium">{order.deliveryRecipient}</p>{order.deliveryRecipientPhone ? <p className="mt-2 text-xs text-muted-foreground">{order.deliveryRecipientPhone}</p> : null}
        {pickup && sent && !delivered ? <p className="mt-3 text-xs leading-6 text-muted-foreground">Lleva tu documento de identidad para recoger las publicaciones.</p> : null}
      </div>
    </div>
    {!pickup && sent ? <div className="flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-border bg-muted/20 p-5 sm:px-6">
      <div><p className="text-[10px] text-muted-foreground">Courier</p><p className="mt-1 text-sm font-semibold">{order.courier || "No registrado"}</p></div>
      <div><p className="text-[10px] text-muted-foreground">Número de guía</p><p className="mt-1 text-sm font-semibold tabular-nums">{order.shippingTrackingCode || "No registrado"}</p></div>
      {order.shippingTrackingUrl ? <a href={order.shippingTrackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-primary/20 bg-white px-4 py-2.5 text-xs font-semibold text-primary hover:bg-secondary/40 sm:ml-auto">Seguir envío<ArrowUpRight className="size-4" /></a> : null}
    </div> : null}
    {order.dispatchedAt || order.deliveredAt ? <dl className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border px-5 py-3 text-[10px] leading-5 text-muted-foreground sm:px-6">
      {order.dispatchedAt ? <div><dt className="inline font-medium">{pickup ? "Disponible desde" : "Enviado"}: </dt><dd className="inline">{dateFormat.format(order.dispatchedAt)}</dd></div> : null}
      {order.deliveredAt ? <div><dt className="inline font-medium">Entregado: </dt><dd className="inline">{dateFormat.format(order.deliveredAt)}</dd></div> : null}
    </dl> : null}
  </section>;
}
