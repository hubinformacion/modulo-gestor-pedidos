"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
const sections = [{ title: "Atención" }, { title: "Pagos" }, { title: "Distribución" }, { title: "Entrega" }];
export function AttentionTabs({ current, panels }: { current: number; panels: ReactNode[] }) {
  const [selected, setSelected] = useState(current);
  return <Tabs.Root value={selected} onValueChange={(value) => { if (typeof value === "number" && !document.querySelector('[data-treasury-upload-busy="true"]')) setSelected(value); }} className="min-w-0 overflow-hidden rounded-xl border border-border bg-white">
    <Tabs.List aria-label="Secciones del pedido" className="workspace-tabs m-3 grid grid-cols-2 sm:grid-cols-4">{sections.map(({ title }, index) => <Tabs.Tab key={title} value={index} className={`flex min-h-14 cursor-pointer items-center justify-center gap-2 border-b-2 px-2 text-[11px] font-medium transition-colors focus-visible:outline-primary sm:text-sm ${selected === index ? "border-primary bg-white text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/30"}`}><span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${selected === index ? "bg-primary text-white" : "bg-secondary text-primary"}`}>{index + 1}</span>{title}</Tabs.Tab>)}</Tabs.List>
    {panels.map((panel, index) => <Tabs.Panel keepMounted key={sections[index].title} value={index} className="p-5 pt-3 outline-none data-[hidden]:hidden sm:p-7 [&_h2]:text-center [&_h2+p]:text-center">{panel}</Tabs.Panel>)}
  </Tabs.Root>;
}
