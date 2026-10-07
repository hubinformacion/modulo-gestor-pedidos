"use client";
import { useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Check, Package, ChevronLeft, ChevronRight } from "lucide-react";
import { orderProgress, type ProgressOrder } from "@/lib/orders/progress";
export function CustomerProgress({ order, panels }: { order: ProgressOrder; panels: ReactNode[] }) {
  const progress = orderProgress(order);
  const current = Math.max(0, progress.index);
  const [selected, setSelected] = useState(current);
  const steps = ["Pago", "Distribución", "Entrega"];
  const delivered = order.orderStatus === "ENTREGADO";
  const canNavigate = () => !document.querySelector('[data-order-editing="true"]');
  return <section className="overflow-hidden rounded-2xl border border-border bg-white"><div className="flex gap-4 bg-secondary/40 p-5 sm:p-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-primary"><Package className="size-5" /></span><div><p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Así va tu pedido</p><h2 className="mt-2 text-xl font-semibold tracking-tight">{progress.title}</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">{progress.description}</p></div></div>
    <Tabs.Root value={selected} onValueChange={(value) => { if (typeof value === "number" && canNavigate()) setSelected(value); }}>
      <Tabs.List aria-label="Etapas de tu pedido" className="grid grid-cols-3 border-b border-border">{steps.map((step, index) => <Tabs.Tab key={step} value={index} className={`flex cursor-pointer items-center justify-center gap-2 border-b-2 px-2 py-4 text-xs ${selected === index ? "border-primary font-semibold text-primary" : "border-transparent text-muted-foreground hover:bg-secondary/20"}`}><span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] ${delivered || index < current ? "bg-primary text-white" : "bg-secondary text-primary"}`}>{delivered || index < current ? <Check className="size-3" /> : index + 1}</span>{step}</Tabs.Tab>)}</Tabs.List>
      {panels.map((panel, index) => <Tabs.Panel key={index} value={index} className="p-4 sm:p-5">{panel}</Tabs.Panel>)}
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3"><button type="button" disabled={selected === 0} className="inline-flex cursor-pointer items-center gap-1 text-xs text-muted-foreground disabled:invisible" onClick={() => { if (canNavigate()) setSelected(selected - 1); }}><ChevronLeft className="size-3" />Anterior</button><span className="text-[10px] text-muted-foreground">{delivered || order.orderStatus === "CANCELADO" ? "Consulta las etapas de tu pedido" : `Etapa ${selected + 1} de 3`}</span><button type="button" disabled={selected === 2} className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary disabled:invisible" onClick={() => { if (canNavigate()) setSelected(selected + 1); }}>Siguiente<ChevronRight className="size-3" /></button></div>
    </Tabs.Root>
  </section>;
}
