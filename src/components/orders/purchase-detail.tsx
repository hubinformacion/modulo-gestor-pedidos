import { SortableTable } from "@/components/workspace/sortable-table";
import { formatMoney, toCents } from "@/modules/orders/domain/money";

type PurchaseItem = {
  basePrice?: string | null;
  discountPercent?: number;
  id: string;
  code: string | null;
  title: string;
  quantity: number;
  price: string;
  subtotal: string;
};

export function PurchaseDetail({ items, subtotal, shipping, total, discountTotal = "0", couponCode }: {
  items: PurchaseItem[];
  subtotal: string;
  shipping: string;
  total: string;
  discountTotal?: string;
  couponCode?: string | null;
}) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="min-w-0 rounded-xl border border-border bg-white p-4 sm:p-5" aria-labelledby="purchase-detail-title">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id="purchase-detail-title" className="text-base font-semibold">Detalle de la compra</h3>
        <span className="text-xs text-muted-foreground">{units} {units === 1 ? "ejemplar" : "ejemplares"}</span>
      </div>
      <div className="grid items-start gap-4 @min-[47rem]/order:grid-cols-[minmax(0,1fr)_minmax(13rem,.35fr)]">
        <div className="overflow-x-auto focus-visible:outline-primary" role="region" aria-label="Publicaciones e importes del pedido" tabIndex={0}>
          <SortableTable className="w-full min-w-[25rem] text-left text-xs">
            <thead className="border-y border-border">
              <tr>{["Código", "Publicación", "Cantidad", "Precio", "Importe"].map((label) => (
                <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-border border-b border-border">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-muted-foreground">{item.code || "Sin código"}</td>
                  <td className="px-3 py-2 font-medium leading-5">{item.title}</td>
                  <td className="px-3 py-2 tabular-nums">{item.quantity}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums" data-sort-value={formatMoney(toCents(item.price))}>
                    {item.discountPercent && item.basePrice ? <span className="mr-1.5 text-muted-foreground line-through">{formatMoney(toCents(item.basePrice))}</span> : null}
                    {formatMoney(toCents(item.price))}
                    {item.discountPercent ? <span className="ml-1.5 font-medium text-primary">−{item.discountPercent}%</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">{formatMoney(toCents(item.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </SortableTable>
        </div>
        <dl className="grid gap-1.5 rounded-lg bg-muted/70 px-4 py-3 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Publicaciones</dt><dd className="tabular-nums">{formatMoney(toCents(subtotal))}</dd></div>
          {toCents(discountTotal) > 0 ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">{couponCode ? `Cupón ${couponCode} incluido` : "Descuento incluido"}</dt><dd className="tabular-nums">{formatMoney(toCents(discountTotal))}</dd></div> : null}
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Envío</dt><dd className="tabular-nums">{formatMoney(toCents(shipping))}</dd></div>
          <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold"><dt>Total</dt><dd className="tabular-nums">{formatMoney(toCents(total))}</dd></div>
        </dl>
      </div>
    </section>
  );
}
