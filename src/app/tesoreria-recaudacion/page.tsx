import { DatePicker } from "@/components/ui/date-picker";
import { peruToday } from "@/lib/dashboard/validation";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { Clock3, FileCheck2, Inbox, MessageSquareWarning, UserRoundCheck, ArrowUpRight, BookOpen } from "lucide-react";
import { WorkspacePageHeading } from "@/components/workspace/page-heading";
import { OrderLiveRefresh } from "@/components/order-live-refresh";
import { TreasuryTrend } from "@/components/dashboard/treasury-chart";
import { SortableTable } from "@/components/sortable-table";
import { treasurySummary, treasurySummaryFilters } from "@/lib/treasury/dashboard";
export const metadata = { title: "Resumen de Tesorería Recaudación" };
export default async function TreasurySummaryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const schema = treasurySummaryFilters(peruToday());
  const parsed = schema.safeParse(await searchParams);
  const filters = parsed.success ? parsed.data : schema.parse({});
  const { data, imprints, service } = await treasurySummary(filters);
  const live = data.live;
  const metrics = [
    { label: "Por asignar", value: live.unassigned, detail: "Libres y sin observaciones abiertas", icon: Inbox },
    { label: "En atención", value: live.attending, detail: "Con responsable, sin observaciones abiertas", icon: UserRoundCheck },
    { label: "Observadas", value: live.observed, detail: "En coordinación con Fondo Editorial", icon: MessageSquareWarning },
    { label: "Finalizadas", value: data.period.finished, detail: "Según fecha de finalización · período elegido", icon: FileCheck2 },
  ];
  const hours = data.period.medianHours;
  const duration = hours === null ? "Sin datos" : hours < 24 ? `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(hours)} h` : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 1 }).format(hours / 24)} días`;
  const inbox = (state: string, owner = "all") => `/tesoreria-recaudacion/solicitudes?${new URLSearchParams({ state, owner, imprint: filters.imprint })}`;
  return <div className="space-y-6">
    <WorkspacePageHeading eyebrow="Tesorería Recaudación" title="Resumen de emisión" description="Organiza la carga del equipo y consulta cómo avanza la emisión de documentos." actions={<><Link href="/tesoreria-recaudacion/solicitudes" className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-white">Ver solicitudes<ArrowUpRight className="size-3.5" /></Link><OrderLiveRefresh finished /></>} />
    <form action="/tesoreria-recaudacion" className="workspace-inline-filters">
      <label className="flex items-center gap-2 text-xs font-medium">Desde<DatePicker aria-label="Desde" name="from" required defaultValue={filters.from} className="h-9 w-40 text-xs" /></label>
      <label className="flex items-center gap-2 text-xs font-medium">Hasta<DatePicker aria-label="Hasta" name="to" required defaultValue={filters.to} className="h-9 w-40 text-xs" /></label>
      <label className="flex items-center gap-2 text-xs font-medium">Unidad de negocio<Select aria-label="Unidad de negocio" name="imprint" defaultValue={filters.imprint} className="h-9 border border-border px-3 text-xs"><option value="">Todas mis unidades</option>{imprints.map((unit) => <option value={unit} key={unit}>{unit === "universidad" ? "Universidad" : "Instituto"}</option>)}</Select></label>
      <button type="submit" className="h-9 rounded-lg bg-primary px-4 text-xs font-semibold text-white">Aplicar</button>
    </form>
    {!parsed.success ? <p role="alert" className="text-xs text-destructive">{parsed.error.issues[0]?.message} Mostramos el mes actual.</p> : null}
    <section aria-label="Indicadores de solicitudes" className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">{metrics.map(({label,value,detail,icon: Icon}) => <article key={label} className="workspace-metric-card"><div className="flex items-center justify-between"><span className="text-xs font-medium text-muted-foreground">{label}</span><Icon className="size-5 text-primary" aria-hidden="true" /></div><p className="mt-4 text-3xl font-semibold tabular-nums">{value}</p><p className="mt-3 text-[11px] leading-5 text-muted-foreground">{detail}</p></article>)}</section>
    <p className="text-[11px] leading-6 text-muted-foreground">Por asignar, en atención y observadas reflejan las solicitudes abiertas actuales, sin límite de fechas. Finalizadas refleja documentos vigentes del período. Una solicitud devuelta deja de contarse como finalizada hasta completar su corrección.</p>
    <div className="workspace-panel-grid">
      <section className="workspace-panel-section"><div className="workspace-panel-heading"><div><h2>Evolución de solicitudes</h2><p>Recibidas por fecha de registro y finalizadas por fecha de emisión.</p></div></div><div className="mb-5 flex flex-wrap gap-5 text-[11px]"><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-[#c7a6e7]" />Recibidas</span><span className="flex items-center gap-2"><i className="size-2.5 rounded-sm bg-primary" />Finalizadas</span></div><TreasuryTrend data={data.trend} /><details className="mt-5 text-xs"><summary className="font-medium text-primary">Consultar datos de la gráfica</summary><div className="mt-3 max-h-64 overflow-auto"><SortableTable className="w-full text-left text-xs"><thead><tr><th>Fecha</th><th>Recibidas</th><th>Finalizadas</th></tr></thead><tbody>{data.trend.map((row) => <tr key={row.day} className="border-b border-border"><td className="py-2">{row.day}</td><td>{row.received}</td><td>{row.finished}</td></tr>)}</tbody></SortableTable></div></details></section>
      <div className="min-w-0 space-y-5"><section className="workspace-panel-section"><div className="workspace-panel-heading"><div><h2>Tiempo de emisión</h2><p>Mediana desde el registro hasta la finalización vigente.</p></div><Clock3 className="size-5 text-primary" /></div><p className="text-3xl font-semibold">{duration}</p><p className="mt-3 text-xs leading-6 text-muted-foreground">{data.period.sample} solicitudes finalizadas · horas y días calendario. Incluye espera y correcciones.</p><dl className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-5"><div><dt className="text-xs text-muted-foreground">Boletas</dt><dd className="mt-2 text-xl font-semibold">{data.period.receipts}</dd></div><div><dt className="text-xs text-muted-foreground">Facturas</dt><dd className="mt-2 text-xl font-semibold">{data.period.invoices}</dd></div></dl></section>
      <section className="workspace-panel-section"><h2 className="text-sm font-semibold">Para continuar</h2><div className="mt-4 space-y-3 text-xs">{!service ? <Link href={inbox("pending","mine")} className="workspace-quick-link">Mis solicitudes abiertas<strong>{live.mine}</strong></Link> : <p className="rounded-lg bg-secondary/50 p-3 leading-6">Este buzón tiene acceso de consulta. La atención se realiza desde una cuenta personal autorizada.</p>}<div className="workspace-quick-link">Abiertas por corregir<strong>{live.returned}</strong></div><Link href="/tesoreria-recaudacion/guia" className="workspace-quick-link"><span className="flex items-center gap-2"><BookOpen className="size-4" />Guía de emisión</span><ArrowUpRight className="size-4" /></Link></div></section></div>
    </div>
    <section className="workspace-panel-section"><div className="workspace-panel-heading"><div><h2>Distribución por unidad de negocio</h2><p>Solicitudes abiertas actuales y documentos vigentes finalizados en el período.</p></div><span className="text-xs text-muted-foreground">{data.period.received} recibidas en el período</span></div><div className="grid gap-4 sm:grid-cols-2">{imprints.filter((unit) => !filters.imprint || filters.imprint === unit).map((unit) => { const row = data.units.find((item) => item.imprint === unit); return <div key={unit} className="rounded-xl border border-border p-5"><span className={`workspace-unit-badge ${unit === "instituto" ? "is-instituto" : ""}`}>{unit === "universidad" ? "Universidad" : "Instituto"}</span><dl className="mt-4 grid grid-cols-2 gap-4 text-xs"><div><dt className="text-muted-foreground">Abiertas</dt><dd className="mt-2 text-xl font-semibold">{row?.open ?? 0}</dd></div><div><dt className="text-muted-foreground">Finalizadas</dt><dd className="mt-2 text-xl font-semibold">{row?.finished ?? 0}</dd></div></dl></div>; })}</div></section>
  </div>;
}
