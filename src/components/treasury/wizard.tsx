"use client";
import { useRef, useState, type ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { Button } from "@/components/ui/button";
import { scrollWizardTo } from "@/lib/ui/wizard-scroll";
const stages = ["Solicitud", "Revisión", "Emisión"];
export function TreasuryWizard({ panels, current }: { panels: ReactNode[]; current: number }) {
  const [selected, setSelected] = useState(current); const root = useRef<HTMLDivElement>(null);
  function go(value: number) { if (document.querySelector('[data-treasury-upload-busy="true"]')) return; setSelected(value); scrollWizardTo(root.current); }
  return <Tabs.Root ref={root} value={selected} onValueChange={(value) => { if (typeof value === "number") go(value); }} className="overflow-hidden rounded-xl border border-border"><Tabs.List aria-label="Pasos de Tesorería Recaudación" className="grid grid-cols-3 border-b border-border bg-muted/20">{stages.map((stage, i) => <Tabs.Tab key={stage} value={i} className={`flex min-h-12 cursor-pointer items-center gap-2 border-b-2 px-3 text-xs font-medium ${selected === i ? "border-primary bg-white text-primary" : "border-transparent text-muted-foreground"}`}><span className="flex size-6 items-center justify-center rounded-md bg-secondary text-primary">{i + 1}</span>{stage}</Tabs.Tab>)}</Tabs.List>{panels.map((panel, i) => <Tabs.Panel keepMounted key={stages[i]} value={i} className="space-y-5 p-5">{panel}<div className="flex items-center justify-between border-t border-border pt-4"><Button type="button" variant="outline" disabled={i === 0} onClick={() => go(i - 1)}>Anterior</Button>{i < 2 ? <Button type="button" onClick={() => go(i + 1)}>Continuar</Button> : null}</div></Tabs.Panel>)}</Tabs.Root>;
}
