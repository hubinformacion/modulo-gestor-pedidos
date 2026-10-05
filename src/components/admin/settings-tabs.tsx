"use client";

import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { UsersRound, MapPin, Landmark, Plug } from "lucide-react";

const sections = [
  { value: "correos", label: "Correos autorizados", Icon: UsersRound },
  { value: "campus", label: "Campus y bibliotecas", Icon: MapPin },
  { value: "cuentas", label: "Cuentas bancarias", Icon: Landmark },
  { value: "integraciones", label: "Integraciones", Icon: Plug },
] as const;

export function SettingsTabs({ emails, campuses, banks, integrations }: { emails: ReactNode; campuses: ReactNode; banks: ReactNode; integrations: ReactNode }) {
  const content = { correos: emails, campus: campuses, cuentas: banks, integraciones: integrations };
  return <Tabs.Root defaultValue="correos" className="mt-7">
    <Tabs.List aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto border-b border-border">
      {sections.map(({ value, label, Icon }) => <Tabs.Tab key={value} value={value} className="inline-flex min-h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-4 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[active]:border-primary data-[active]:text-primary sm:text-sm"><Icon className="size-4" aria-hidden="true" />{label}</Tabs.Tab>)}
    </Tabs.List>
    {sections.map(({ value }) => <Tabs.Panel key={value} value={value} keepMounted className="pt-7 data-[hidden]:hidden">{content[value]}</Tabs.Panel>)}
  </Tabs.Root>;
}
