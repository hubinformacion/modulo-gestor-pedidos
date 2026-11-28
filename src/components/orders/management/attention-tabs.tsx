"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Check } from "lucide-react";
import { cn } from "@/shared/utils/cn";

const steps = ["Atención", "Pagos", "Distribución", "Entrega"] as const;
const desktop = "(min-width: 1280px)";
const subscribe = (update: () => void) => {
  const query = window.matchMedia(desktop);
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
};
const isDesktop = () => window.matchMedia(desktop).matches;

export function AttentionTabs({ current, progress, outcome, panels }: {
  current: number;
  progress: number;
  outcome: "active" | "completed" | "cancelled";
  panels: ReactNode[];
}) {
  const [inspected, setInspected] = useState<number | null>(null);
  if (inspected !== null && inspected === current) setInspected(null);
  const selected = inspected ?? current;
  const vertical = useSyncExternalStore(subscribe, isDesktop, () => false);
  return (
    <Tabs.Root
      value={selected}
      orientation={vertical ? "vertical" : "horizontal"}
      onValueChange={(value) => {
        if (typeof value === "number" && !document.querySelector('[data-sale-upload-busy="true"], [data-evidence-upload-busy="true"]')) {
          setInspected(value === current ? null : value);
        }
      }}
      className="grid min-w-0 gap-y-5 xl:grid-cols-[11.5rem_minmax(0,1fr)] xl:gap-x-7 2xl:gap-x-9"
    >
      <Tabs.List
        aria-label="Pasos del pedido"
        className="grid min-w-0 grid-cols-4 gap-1 rounded-lg bg-muted/50 p-1 xl:sticky xl:top-20 xl:grid-cols-1 xl:self-start xl:p-1.5"
      >
        {steps.map((title, index) => {
          const complete = (index !== current && index < progress) || outcome === "completed";
          const active = index === current && outcome === "active";
          const interrupted = index === current && outcome === "cancelled";
          const state = active ? "En curso" : complete ? "Completado" : interrupted ? "Cancelado" : "Pendiente";
          return (
            <Tabs.Tab
              key={title}
              value={index}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-md px-0.5 py-2 text-center outline-none transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-2 xl:flex-row xl:gap-2.5 xl:px-2 xl:text-left",
                selected === index && "bg-secondary text-primary",
              )}
            >
              <span aria-hidden="true" className={cn(
                "relative grid size-6 shrink-0 place-items-center rounded-full border border-border bg-white text-xs font-semibold text-muted-foreground tabular-nums",
                active && "border-primary bg-primary text-primary-foreground",
                complete && "border-emerald-200 bg-emerald-50 text-emerald-800",
                interrupted && "border-rose-200 bg-rose-50 text-rose-800",
              )}>
                {index + 1}
                {complete ? <Check className="absolute -bottom-1 -right-1 size-3 rounded-full bg-emerald-100 text-emerald-900" /> : null}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-[0.6875rem] font-semibold sm:text-xs xl:text-sm"><span className="sr-only">Paso {index + 1}. </span>{title}</span>
                <span className="sr-only xl:not-sr-only xl:mt-1 xl:block xl:text-xs xl:text-muted-foreground">{state}</span>
              </span>
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
      <div className="order-detail-content min-w-0">
        {panels.map((panel, index) => (
          <Tabs.Panel keepMounted key={steps[index]} value={index} className="step-panel min-w-0 outline-none data-[hidden]:hidden">
            {panel}
          </Tabs.Panel>
        ))}
      </div>
    </Tabs.Root>
  );
}
