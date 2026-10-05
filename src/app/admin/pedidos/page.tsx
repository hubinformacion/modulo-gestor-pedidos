import type { Metadata } from "next";
import Link from "next/link";
import { listOrders } from "@/lib/admin/data";
import { filterSchema, orderLabels, paymentLabels } from "@/lib/admin/validation";
import { requirePageAccess } from "@/lib/access";
import { formatMoney, toCents } from "@/lib/orders/money";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";

export const metadata: Metadata = { title: "Pedidos" };
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageAccess();
  const filters = filterSchema.parse(await searchParams);
  const { rows, total } = await listOrders(filters);
  const pages = Math.max(1, Math.ceil(total / 20));
  const url = (page: number) => `/admin/pedidos?${new URLSearchParams({ q: filters.q, status: filters.status, payment: filters.payment, imprint: filters.imprint, page: String(page) })}`;
  return <>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="page-heading">Pedidos</h1><p className="mt-3 text-sm text-muted-foreground">Revisa pagos y coordina la entrega de cada compra.</p></div><span className="text-xs text-muted-foreground">{total} {total === 1 ? "pedido" : "pedidos"}</span></div>
    <form action="/admin/pedidos" method="get" className="mt-7 grid items-end gap-4 rounded-xl border border-border bg-muted/20 p-5 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
      <Field id="order-search" name="q" label="Buscar pedido" defaultValue={filters.q} placeholder="Número, comprador o correo" maxLength={120} />
      <SelectField id="order-status" name="status" label="Estado" defaultValue={filters.status}><option value="">Todos los estados</option>{Object.entries(orderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <SelectField id="order-payment" name="payment" label="Pago" defaultValue={filters.payment}><option value="">Todos los pagos</option>{Object.entries(paymentLabels).filter(([value]) => value !== "NO_APLICA").map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField>
      <SelectField id="order-imprint" name="imprint" label="Sello" defaultValue={filters.imprint}><option value="">Ambos sellos</option><option value="universidad">Universidad</option><option value="instituto">Instituto</option></SelectField>
      <Button type="submit" className="h-11">Filtrar</Button>
      {filters.q || filters.status || filters.payment || filters.imprint ? <Link href="/admin/pedidos" className="text-xs font-medium text-primary underline underline-offset-4 sm:col-span-2 lg:col-span-5">Limpiar filtros</Link> : null}
    </form>
    <div className="mt-6 overflow-x-auto rounded-xl border border-border"><table className="w-full text-left text-xs"><caption className="sr-only">Pedidos y estado de los pagos por sello editorial</caption><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr>{["Pedido", "Comprador", "Total", "Estado", "Universidad", "Instituto", ""].map((label, index) => <th key={index} scope="col" className="whitespace-nowrap px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-muted/20"><td className="whitespace-nowrap px-4 py-5"><Link href={`/admin/pedidos/${row.id}`} className="font-semibold text-primary underline-offset-4 hover:underline">{row.number}</Link><p className="mt-2 text-[11px] text-muted-foreground">{dateFormat.format(row.createdAt)}</p></td><td className="px-4 py-5"><p className="font-medium">{row.name}</p><p className="mt-2 text-muted-foreground">{row.email}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.delivery === "delivery" ? "Envío a domicilio" : "Recojo en biblioteca"}</p></td><td className="whitespace-nowrap px-4 py-5 font-semibold tabular-nums">{formatMoney(toCents(row.total))}</td><td className="px-4 py-5"><StatusBadge status={row.status} /></td><td className="px-4 py-5"><StatusBadge status={row.universidad} /></td><td className="px-4 py-5"><StatusBadge status={row.instituto} /></td><td className="px-4 py-5"><Link href={`/admin/pedidos/${row.id}`} className="font-medium text-primary hover:underline">Revisar<span className="sr-only"> pedido {row.number}</span></Link></td></tr>)}</tbody></table>{!rows.length ? <div className="p-12 text-center"><p className="text-sm font-medium">No hay pedidos para esta selección.</p><p className="mt-2 text-xs text-muted-foreground">Los pedidos registrados aparecerán aquí para su revisión.</p></div> : null}</div>
    <nav aria-label="Páginas de pedidos" className="mt-5 flex items-center justify-between gap-3 text-xs"><span className="text-muted-foreground">Página {filters.page} de {pages} · 20 por página</span><div className="flex gap-4">{filters.page > 1 ? <Link className="font-medium text-primary" href={url(filters.page - 1)}>Anterior</Link> : null}{filters.page < pages ? <Link className="font-medium text-primary" href={url(filters.page + 1)}>Siguiente</Link> : null}</div></nav>
  </>;
}
