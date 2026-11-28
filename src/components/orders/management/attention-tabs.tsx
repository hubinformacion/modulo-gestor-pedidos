"use client";

import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { cn } from "@/shared/utils/cn";

const steps = ["Atención", "Pagos", "Distribución", "Entrega"] as const;

export function AttentionTabs({ current, progress, outcome, panels }: {
  current: number;
  progress: number;
  outcome: "active" | "completed" | "cancelled";
  panels: ReactNode[];
}) {
  const [inspected, setInspected] = useState<number | null>(null);
  if (inspected !== null && inspected === current) setInspected(null);
  const selected = inspected ?? current;

  return (
    <Tabs.Root
      value={selected}
      onValueChange={(value) => {
        if (typeof value === "number" && !document.querySelector('[data-sale-upload-busy="true"], [data-evidence-upload-busy="true"]')) {
          setInspected(value === current ? null : value);
        }
      }}
      className="@container/order min-w-0 space-y-4"
    >
      <Tabs.List
        aria-label="Pasos del pedido"
        className="grid min-w-0 grid-cols-4 divide-x divide-border rounded-xl border border-border bg-white"
      >
        {steps.map((title, index) => {
          const complete = outcome === "completed" || (index < progress && index !== current);
          const active = index === current && outcome === "active";
          const interrupted = index === current && outcome === "cancelled";
          const state = active ? "En curso" : complete ? "Completado" : interrupted ? "Cancelado" : "Pendiente";
          return (
            <Tabs.Tab
              key={title}
              value={index}
              aria-current={active || interrupted ? "step" : undefined}
              className={cn(
                "relative flex min-w-0 flex-col items-center gap-1.5 overflow-hidden px-px py-2.5 text-center outline-none transition-colors first:rounded-l-xl last:rounded-r-xl hover:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring @min-[35rem]/order:flex-row @min-[35rem]/order:gap-3 @min-[35rem]/order:px-4 @min-[35rem]/order:py-3 @min-[35rem]/order:text-left",
                selected === index && "bg-secondary text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-primary hover:bg-secondary",
              )}
            >
              <span aria-hidden="true" className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border border-border bg-white text-xs font-semibold text-muted-foreground tabular-nums @min-[35rem]/order:size-8",
                active && "border-primary bg-primary text-primary-foreground",
                complete && "border-emerald-200 bg-emerald-50 text-emerald-800",
                interrupted && "border-rose-200 bg-rose-50 text-rose-800",
              )}>{index + 1}</span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[0.6875rem] font-semibold @min-[35rem]/order:text-sm"><span className="sr-only">Paso {index + 1}. </span>{title}</span>
                <span className={cn(
                  "mt-0.5 block text-[0.625rem] text-muted-foreground @min-[35rem]/order:text-xs",
                  active && "font-medium text-primary",
                  complete && "text-emerald-800",
                  interrupted && "text-rose-800",
                )}>{state}</span>
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      {panels.map((panel, index) => (
        <Tabs.Panel keepMounted key={steps[index]} value={index} className="step-panel min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring data-[hidden]:hidden">
          {panel}
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
