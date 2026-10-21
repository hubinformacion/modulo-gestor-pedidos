"use client";

import type { ReactNode } from "react";
import { Tabs } from "@base-ui/react/tabs";
import { UsersRound, MapPin, Landmark, Plug, ReceiptText, ShieldCheck, Truck } from "lucide-react";
const sections = [
  { value: "correos", label: "Accesos", detail: "Gestores autorizados", Icon: UsersRound },
  { value: "campus", label: "Campus", detail: "Bibliotecas y recojo", Icon: MapPin },
  { value: "apoyo", label: "Apoyo para recojo", detail: "Personal y contactos", Icon: UsersRound },
  { value: "cuentas", label: "Cuentas bancarias", detail: "Datos para depósitos", Icon: Landmark },
  { value: "delivery", label: "Delivery", detail: "Tarifas de envío", Icon: Truck },
  { value: "caja", label: "Tesorería Recaudación", detail: "Buzones y personas", Icon: ReceiptText },
  { value: "seguridad", label: "Seguridad", detail: "Límites de pedidos", Icon: ShieldCheck },
  { value: "integraciones", label: "Integraciones", detail: "Registro y pagos", Icon: Plug },
] as const;
export function SettingsTabs({ emails, campuses, banks, integrations, caja, security, support, delivery }: { emails: ReactNode; campuses: ReactNode; banks: ReactNode; integrations: ReactNode; caja: ReactNode; security: ReactNode; support: ReactNode; delivery: ReactNode }) {
  const content = { correos: emails, campus: campuses, cuentas: banks, integraciones: integrations, caja, seguridad: security, apoyo: support, delivery };
  return <Tabs.Root defaultValue="correos" className="mt-7">
    <Tabs.List aria-label="Secciones de configuración" className="workspace-settings-tabs">{sections.map(({ value, label, detail, Icon }) => <Tabs.Tab key={value} value={value} className="workspace-settings-tab"><Icon className="size-5 shrink-0" aria-hidden="true" /><span className="min-w-0 text-left"><span className="block text-xs font-semibold">{label}</span><span className="mt-1 hidden text-[10px] text-muted-foreground sm:block">{detail}</span></span></Tabs.Tab>)}</Tabs.List>
    {sections.map(({ value }) => <Tabs.Panel key={value} value={value} keepMounted className="mt-7 outline-none data-[hidden]:hidden">{content[value]}</Tabs.Panel>)}
  </Tabs.Root>;
}
