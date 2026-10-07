import { DetailButton } from "@/components/detail-button";
import type { Metadata } from "next";
import Link from "next/link";
import { listOrders } from "@/lib/admin/data";
import { filterSchema, orderLabels } from "@/lib/admin/validation";
import { requirePageAccess } from "@/lib/access";
import { formatMoney, toCents } from "@/lib/orders/money";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderLiveRefresh } from "@/components/order-live-refresh";

export const metadata: Metadata = { title: "Atención de pedidos" };
const dateFormat = new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeZone: "America/Lima" });
export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requirePageAccess();
  const filters = filterSchema.parse(await searchParams);
  const { rows, total } = await listOrders(filters);
  const pages = Math.max(1, Math.ceil(total / 20));
  const url = (page: number, owner = filters.owner) => `/admin/pedidos?${new URLSearchParams({ q: filters.q, status: filters.status, owner, page: String(page) })}`;
  return <><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Bandeja de atención</p><h1 className="page-heading mt-2">Pedidos</h1><p className="mt-3 text-sm text-muted-foreground">Toma un pedido y acompaña al comprador hasta la entrega.</p></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{total} {total === 1 ? "pedido" : "pedidos"}</span><OrderLiveRefresh /></div></div>

    <form action="/admin/pedidos" method="get" className="mt-5 grid items-end gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_11rem_11rem_auto]"><Field id="order-search" name="q" label="Buscar pedido" defaultValue={filters.q} placeholder="Número, comprador o gestor" maxLength={120} /><SelectField id="order-owner" name="owner" label="Bandeja" defaultValue={filters.owner}><option value="all">Todos</option><option value="unassigned">Por asignar</option><option value="mine">Mis pedidos</option></SelectField><SelectField id="order-status" name="status" label="Estado" defaultValue={filters.status}><option value="">Todos los estados</option>{Object.entries(orderLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</SelectField><Button type="submit" className="h-11 px-4">Filtrar</Button>{filters.q || filters.status ? <Link href={`/admin/pedidos?owner=${filters.owner}`} className="text-xs font-medium text-primary underline underline-offset-4 sm:col-span-2 xl:col-span-4">Limpiar filtros</Link> : null}</form>
    <div className="mt-5 overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[850px] text-left text-xs"><caption className="sr-only">Pedidos, gestor responsable y estado de atención</caption><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr>{["Pedido", "Comprador", "Gestor", "Entrega", "Estado", "Importe", ""].map((label, index) => <th key={index} scope="col" className="whitespace-nowrap px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={row.id} className="hover:bg-muted/20"><td className="whitespace-nowrap px-4 py-5"><Link href={`/admin/pedidos/${row.id}`} className="font-semibold text-primary hover:underline">{row.number}</Link><p className="mt-2 text-[10px] text-muted-foreground">{dateFormat.format(row.createdAt)}</p></td><td className="px-4 py-5"><p className="font-medium">{row.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{row.email}</p></td><td className="px-4 py-5">{row.assignedTo ? <><p className="font-medium">{row.assignedName || "Gestor"}</p></> : <span className="rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-800">Sin asignar</span>}</td><td className="px-4 py-5 text-muted-foreground">{row.delivery === "delivery" ? "Domicilio" : "Biblioteca"}</td><td className="px-4 py-5"><StatusBadge status={row.attentionStatus} /></td><td className="whitespace-nowrap px-4 py-5 font-semibold tabular-nums">{formatMoney(toCents(row.total))}</td><td className="px-4 py-5"><DetailButton href={`/admin/pedidos/${row.id}`} context={`pedido ${row.number}`} /></td></tr>)}</tbody></table>{!rows.length ? <div className="p-12 text-center"><p className="text-sm font-medium">No hay pedidos en esta bandeja.</p><p className="mt-2 text-xs text-muted-foreground">Los pedidos aparecerán aquí cuando se registren o se asignen.</p></div> : null}</div>
    <nav aria-label="Páginas de pedidos" className="mt-5 flex items-center justify-between text-xs"><span className="text-muted-foreground">Página {filters.page} de {pages}</span><div className="flex gap-4">{filters.page > 1 ? <Link className="font-medium text-primary" href={url(filters.page - 1)}>Anterior</Link> : null}{filters.page < pages ? <Link className="font-medium text-primary" href={url(filters.page + 1)}>Siguiente</Link> : null}</div></nav>
  </>;
}
