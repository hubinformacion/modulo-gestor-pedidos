import { BookOpen } from "lucide-react";
import { SortableTable } from "@/components/sortable-table";
import { DetailCardHeading } from "@/components/workspace/detail-card-heading";
import { formatMoney, toCents } from "@/lib/orders/money";

type PurchaseItem = { id: string; code: string | null; title: string; quantity: number; price: string; subtotal: string };
export function PurchaseDetail({ items, subtotal, shipping, total, discountTotal = "0", couponCode, totalLabel = "Total", description = "Publicaciones e importes del pedido." }: {
  items: PurchaseItem[];
  subtotal: string;
  shipping: string;
  total: string;
  discountTotal?: string;
  couponCode?: string | null;
  totalLabel?: string;
  description?: string;
}) {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return <section className="purchase-detail" aria-label="Detalle de la compra">
    <DetailCardHeading icon={BookOpen} title="Detalle de la compra" description={description} aside={<span className="text-[10px] text-muted-foreground">{units} {units === 1 ? "unidad" : "unidades"}</span>} />
    <div className="overflow-x-auto"><SortableTable className="purchase-detail-table w-full min-w-[520px] text-left text-xs">
      <thead><tr>{["Código", "Publicación", "Cantidad", "Precio", "Importe"].map((label) => <th key={label} scope="col" className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
      <tbody>{items.map((item) => <tr key={item.id} className="border-b border-border"><td className="px-4 py-4 text-muted-foreground">{item.code || "Sin código"}</td><td className="px-4 py-4 font-medium leading-6">{item.title}</td><td className="px-4 py-4 tabular-nums">{item.quantity}</td><td className="whitespace-nowrap px-4 py-4 tabular-nums">{formatMoney(toCents(item.price))}</td><td className="whitespace-nowrap px-4 py-4 font-semibold tabular-nums">{formatMoney(toCents(item.subtotal))}</td></tr>)}</tbody>
    </SortableTable></div>
    <div className="purchase-detail-footer"><p>Importes en soles (PEN).</p><dl>
      <div><dt>Publicaciones</dt><dd>{formatMoney(toCents(subtotal))}</dd></div>
      {toCents(discountTotal) > 0 ? <div><dt>{couponCode ? `Cupón ${couponCode} incluido` : "Descuento incluido"}</dt><dd>{formatMoney(toCents(discountTotal))}</dd></div> : null}
      <div><dt>Costo por envío</dt><dd>{formatMoney(toCents(shipping))}</dd></div>
      <div><dt>{totalLabel}</dt><dd>{formatMoney(toCents(total))}</dd></div>
    </dl></div>
  </section>;
}
