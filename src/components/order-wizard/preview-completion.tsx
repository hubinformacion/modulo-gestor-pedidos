import { ClipboardCheck } from "lucide-react";
import type { BuyerDraft, Campus, DeliveryDraft } from "@/lib/orders/types";
import type { OrderQuote } from "@/lib/orders/pricing";
import { formatMoney } from "@/lib/orders/money";

export function PreviewCompletion({ quote, buyer, delivery, campuses }: {
  quote: OrderQuote; buyer: BuyerDraft; delivery: DeliveryDraft; campuses: Campus[];
}) {
  const campus = campuses.find((item) => item.id === delivery.campus);
  return <section role="status" aria-labelledby="preview-complete-title" className="mt-6 rounded-xl border border-primary/25 bg-secondary/30 p-5">
    <ClipboardCheck className="mb-3 size-5 text-primary" aria-hidden="true" />
    <p className="text-xs font-semibold text-primary">Vista previa del cierre</p>
    <h2 id="preview-complete-title" className="mt-2 text-base font-semibold">Tu selección está lista</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Este recorrido no ha creado un pedido, reservado stock ni enviado un correo.</p>
    <dl className="mt-5 space-y-3 text-sm">
      <div className="flex justify-between gap-3"><dt>Publicaciones</dt><dd>{quote.quantity} unidades</dd></div>
      <div className="flex justify-between gap-3 font-semibold"><dt>Total previsto</dt><dd>{formatMoney(quote.total)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Correo de confirmación</dt><dd className="mt-1 break-all">{buyer.email}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Entrega</dt><dd className="mt-1">{delivery.type === "recojo_campus" ? `Biblioteca · ${campus?.name ?? ""}` : delivery.address}</dd></div>
    </dl>
    <div className="mt-5 border-t border-primary/15 pt-4">
      <h3 className="text-sm font-semibold">¿Qué seguirá cuando se habiliten los pedidos?</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-6 text-muted-foreground">
        <li>Recibirás el número de pedido, su enlace de seguimiento y la guía de pago en tu correo.</li>
        <li>{quote.orderType === "mixto" ? "Realizarás dos depósitos independientes. El envío se abonará a la cuenta de Universidad Continental." : "Realizarás el depósito según la cuenta indicada en la guía de pago."}</li>
        <li>Adjuntarás tus comprobantes en el seguimiento. La preparación comenzará cuando se verifiquen los pagos requeridos.</li>
      </ol>
    </div>
  </section>;
}
