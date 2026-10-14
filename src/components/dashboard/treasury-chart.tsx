"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { TreasurySummary } from "@/lib/treasury/dashboard-types";
const config = { received: { label: "Recibidas", color: "#c7a6e7" }, finished: { label: "Finalizadas", color: "#6802C1" } };
export function TreasuryTrend({ data }: { data: TreasurySummary["trend"] }) {
  if (!data.some((point) => point.received || point.finished)) return <div className="flex min-h-64 items-center justify-center rounded-xl bg-secondary/30 p-6 text-center text-sm text-muted-foreground">Aún no hay actividad registrada en este período.</div>;
  return <ChartContainer config={config} className="h-72 w-full" aria-label="Solicitudes recibidas y finalizadas por fecha">
    <BarChart accessibilityLayer data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
      <CartesianGrid vertical={false} /><XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={28} tickFormatter={(day: string) => `${day.slice(8,10)}/${day.slice(5,7)}`} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
      <ChartTooltip isAnimationActive={false} content={<ChartTooltipContent labelFormatter={(day) => String(day).split("-").reverse().join("/")} />} />
      <Bar dataKey="received" fill="var(--color-received)" radius={[3,3,0,0]} maxBarSize={18} isAnimationActive={false} />
      <Bar dataKey="finished" fill="var(--color-finished)" radius={[3,3,0,0]} maxBarSize={18} isAnimationActive={false} />
    </BarChart>
  </ChartContainer>;
}
