"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
const stages = [
  { title: "Atención", hint: "Responsable y revisión" }, { title: "Pagos", hint: "Comprobantes por sello" },
  { title: "Preparación", hint: "Publicaciones y salida" }, { title: "Entrega", hint: "Seguimiento y cierre" },
];
export function AttentionWizard({ current, completed, panels }: { current: number; completed: boolean; panels: ReactNode[] }) {
  const [selected, setSelected] = useState(current);
  return <Tabs.Root value={selected} onValueChange={(value) => { if (typeof value === "number") setSelected(value); }} className="overflow-hidden rounded-xl border border-border bg-white">
    <Tabs.List aria-label="Etapas de atención" className="grid grid-cols-4 border-b border-border bg-muted/20">
      {stages.map((stage, index) => <Tabs.Tab key={stage.title} value={index} className={`relative flex cursor-pointer items-center justify-center gap-2 border-b-2 px-2 py-3 text-[10px] transition-colors sm:justify-start sm:px-4 sm:text-xs ${selected === index ? "border-primary bg-white font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/30"}`}>
        <span className={`flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] ${index < current || completed ? "bg-primary text-white" : selected === index ? "bg-secondary text-primary" : "bg-muted"}`}>{index < current || completed ? <Check className="size-3" /> : index + 1}</span>
        <span>{stage.title}<span className="mt-1 hidden text-[9px] font-normal text-muted-foreground xl:block">{stage.hint}</span></span>
      </Tabs.Tab>)}
    </Tabs.List>
    {panels.map((panel, index) => <Tabs.Panel key={index} value={index} className="p-4 sm:p-5">{panel}</Tabs.Panel>)}
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/10 px-4 py-3">
      <button type="button" disabled={selected === 0} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground disabled:invisible" onClick={() => setSelected(selected - 1)}><ChevronLeft className="size-3" />Anterior</button>
      {selected !== current ? <button type="button" className="cursor-pointer text-[10px] font-semibold text-primary" onClick={() => setSelected(current)}>Volver a la etapa actual</button> : <span className="text-[10px] text-muted-foreground">{completed ? "Atención completada" : `Etapa actual · ${stages[current].title}`}</span>}
      <button type="button" disabled={selected === stages.length - 1} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary disabled:invisible" onClick={() => setSelected(selected + 1)}>Siguiente<ChevronRight className="size-3" /></button>
    </div>
  </Tabs.Root>;
}
