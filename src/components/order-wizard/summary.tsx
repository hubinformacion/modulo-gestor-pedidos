import { ShoppingBag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/orders/money";
import { imprintNames } from "@/lib/orders/types";
import type { OrderQuote } from "@/lib/orders/pricing";

export function OrderSummary({ quote, onRemove, editable = true }: {
  quote: OrderQuote; onRemove: (bookId: string) => void; editable?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-white" aria-labelledby="order-summary-title">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 id="order-summary-title" className="flex items-center gap-2 text-sm font-semibold"><ShoppingBag className="size-4 text-primary" aria-hidden="true" />Tu selección</h2>
        <span className="rounded-md bg-muted px-2 py-1 text-[11px] font-medium tabular-nums">{quote.quantity} {quote.quantity === 1 ? "unidad" : "unidades"}</span>
      </div>
      <div className="p-5">
        {quote.lines.length ? (
          <ul className="space-y-4">
            {quote.lines.map((line) => <li key={line.book.id} className="flex items-start gap-2">
              <span className="mt-0.5 min-w-6 rounded bg-muted px-1 text-center text-xs leading-6 tabular-nums">{line.quantity}×</span>
              <div className="min-w-0 flex-1"><p className="text-xs font-medium leading-5">{line.book.title}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatMoney(line.unitPrice)} c/u</p></div>
              <div className="text-right"><p className="text-xs font-semibold leading-6 tabular-nums">{formatMoney(line.subtotal)}</p>{editable ? <Button size="icon-sm" variant="ghost" className="mt-0.5 text-muted-foreground" onClick={() => onRemove(line.book.id)} aria-label={`Eliminar ${line.book.title} de la selección`}><X className="size-3" aria-hidden="true" /></Button> : null}</div>
            </li>)}
          </ul>
        ) : <p className="py-5 text-center text-xs leading-6 text-muted-foreground">Añade publicaciones para ver el detalle de tu pedido.</p>}
        {quote.lines.length ? <>
          <div className="mt-5 space-y-3 border-t border-border pt-5">
            <div className="flex justify-between text-xs"><span className="text-muted-foreground">Publicaciones</span><span className="tabular-nums">{formatMoney(quote.originalSubtotal)}</span></div>{quote.discountTotal > 0 ? <div className="flex justify-between text-xs text-primary"><span>{quote.couponApplied ? `Cupón ${quote.couponApplied.code}` : "Descuento por promoción"}</span><span className="tabular-nums">−{formatMoney(quote.discountTotal)}</span></div> : null}
            <div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">Costo por envío</span><span className="tabular-nums">{quote.shippingKnown ? formatMoney(quote.shippingCost) : "Por seleccionar"}</span></div>
            <div className="flex justify-between gap-3 border-t border-border pt-4"><span className="text-sm font-semibold">{quote.shippingKnown ? "Total" : "Subtotal"}</span><span className="text-xl font-semibold tracking-tight tabular-nums">{formatMoney(quote.total)}</span></div>
          </div>

        </> : null}
      </div>
    </section>
  );
}

export function AccountBreakdown({ quote }: { quote: OrderQuote }) {
  if (quote.orderType !== "mixto") return null;
  return <section className="rounded-xl border border-primary/15 bg-secondary/50 p-5" aria-labelledby="accounts-title">
          <div className="space-y-4">
            <h2 id="accounts-title" className="text-sm font-semibold">Desglose por cuenta</h2>
            {quote.accounts.map((account) => <div key={account.imprint} className="space-y-2">
              <p className="text-xs font-semibold">{imprintNames[account.imprint]}</p>
              <div className="flex justify-between text-[11px] text-muted-foreground"><span>Publicaciones</span><span className="tabular-nums">{formatMoney(account.subtotal)}</span></div>
              {account.imprint === "universidad" ? <div className="flex justify-between gap-3 text-[11px] text-muted-foreground"><span>Costo por envío</span><span className="tabular-nums">{quote.shippingKnown ? formatMoney(account.shipping) : "Por seleccionar"}</span></div> : null}
              <div className="flex justify-between text-xs font-semibold"><span>Total de la cuenta</span><span className="tabular-nums">{formatMoney(account.total)}</span></div>
            </div>)}
          </div>
          {quote.orderType === "mixto" ? <p className="mt-3 text-xs leading-5 text-muted-foreground">Este pedido requiere <strong className="font-medium text-foreground">dos depósitos independientes</strong>. El envío se abona solo a la cuenta de Universidad.</p> : null}
  </section>;
}
