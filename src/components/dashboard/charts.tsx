"use client";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatMoney } from "@/lib/orders/money";
import type { DashboardData } from "@/lib/dashboard/types";
const config = {
  requestedCents: { label: "Solicitado", color: "#6802C1" },
  verifiedCents: { label: "Verificado", color: "#9580b4" },
  count: { label: "Pedidos", color: "#6802C1" },
  quantity: { label: "Unidades", color: "#6802C1" },
};
function Empty() { return <div className="flex h-64 items-center justify-center rounded-lg bg-muted/30 text-sm text-muted-foreground">Sin pedidos en este período.</div>; }
function ShortDate({ value }: { value: string }) { return <span>{value.slice(8, 10)}/{value.slice(5, 7)}</span>; }
export function TrendChart({ trend, money = false }: { trend: DashboardData["trend"]; money?: boolean }) {
  if (!trend.some((point) => point.count)) return <Empty />;
  return <ChartContainer config={config} className="h-64 w-full" aria-label={money ? "Evolución del importe solicitado y verificado" : "Pedidos registrados por día"}>
    <LineChart accessibilityLayer data={trend} margin={{ top: 12, left: 0, right: 12, bottom: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={32} tickFormatter={(day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`} />
      <YAxis tickLine={false} axisLine={false} width={64} allowDecimals={false} tickFormatter={(value: number) => money ? `S/ ${Math.round(value / 100)}` : String(value)} />
      <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent labelFormatter={(label) => <ShortDate value={String(label)} />} formatter={(value, name) => <div className="flex w-full min-w-36 justify-between gap-4 text-xs"><span>{money ? name === "requestedCents" ? "Solicitado" : "Verificado" : "Pedidos"}</span><strong>{money ? formatMoney(Number(value)) : String(value)}</strong></div>} />} />
      <Line dataKey={money ? "requestedCents" : "count"} type="linear" stroke="#6802C1" strokeWidth={2} dot={trend.length <= 7} isAnimationActive={false} />
      {money ? <Line dataKey="verifiedCents" type="linear" stroke="#9580b4" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} /> : null}
    </LineChart>
  </ChartContainer>;
}
export function StockRanking({ books }: { books: DashboardData["topBooks"] }) {
  if (!books.length) return <Empty />;
  const rows = books.map((book, index) => ({ ...book, label: `${index + 1}` }));
  return <ChartContainer config={config} className="h-64 w-full" aria-label="Publicaciones más solicitadas por unidades">
    <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 20 }}>
      <CartesianGrid horizontal={false} /><YAxis dataKey="label" type="category" width={28} tickLine={false} axisLine={false} /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
      <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent labelFormatter={(_, payload) => payload?.[0]?.payload?.title ?? "Publicación"} />} />
      <Bar dataKey="quantity" fill="#6802C1" radius={[0, 4, 4, 0]} isAnimationActive={false} maxBarSize={28} />
    </BarChart>
  </ChartContainer>;
}
