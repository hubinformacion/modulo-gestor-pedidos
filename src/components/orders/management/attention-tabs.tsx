"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
const sections = [
  { title: "Atención", description: "Responsable y datos de compra" },
  { title: "Pagos", description: "Depósitos y documentos de venta" },
  { title: "Distribución", description: "Publicaciones y despacho" },
  { title: "Entrega", description: "Constancia y cierre del pedido" },
];
export function AttentionTabs({ current, panels }: { current: number; panels: ReactNode[] }) {
  const [selected, setSelected] = useState(current);
  return <Tabs.Root value={selected} onValueChange={(value) => { if (typeof value === "number" && !document.querySelector('[data-treasury-upload-busy="true"]')) setSelected(value); }} className="min-w-0">
    <Tabs.List aria-label="Secciones del pedido" className="workspace-attention-tabs">{sections.map(({ title, description }, index) => <Tabs.Tab key={title} value={index} className="workspace-attention-tab"><span className="workspace-tab-number">{index + 1}</span><span><span className="block text-xs font-semibold sm:text-sm">{title}</span><span className="mt-1 hidden text-[10px] text-muted-foreground xl:block">{description}</span></span></Tabs.Tab>)}</Tabs.List>
    {panels.map((panel, index) => <Tabs.Panel keepMounted key={sections[index].title} value={index} className="workspace-attention-panel mt-6 outline-none data-[hidden]:hidden">{panel}</Tabs.Panel>)}
  </Tabs.Root>;
}
