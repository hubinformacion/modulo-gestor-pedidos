"use client";
import { useState, type ComponentProps } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "./calendar";
import { Select } from "./select";
import { cn } from "@/shared/utils/cn";

type RangeValue = { from: string; to: string };
type Props = Pick<ComponentProps<"button">, "id" | "disabled" | "className" | "aria-label" | "aria-labelledby"> & {
  value?: RangeValue; defaultValue?: RangeValue; onValueChange?: (value: RangeValue) => void;
  fromName?: string; toName?: string; required?: boolean; withTime?: boolean; maxDays?: number;
};
const hours = Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }));
const minutes = Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }));
const empty = { from: "", to: "" };
function dateOf(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : undefined;
}
function describe(value: string, withTime: boolean) {
  const date = dateOf(value);
  return date ? `${format(date, "dd MMM yyyy", { locale: es })}${withTime ? ` · ${value.slice(11,16) || "00:00"}` : ""}` : "";
}
function RangeControl({ value, defaultValue, onValueChange, fromName, toName, required = false, withTime = false, maxDays, className, disabled, ...props }: Props) {
  const [local, setLocal] = useState(defaultValue ?? empty);
  const [draft, setDraft] = useState(value ?? defaultValue ?? empty);
  const [open, setOpen] = useState(false);
  const current = value ?? local;
  const from = dateOf(draft.from), to = dateOf(draft.to);
  const validDates = !required || Boolean(from && to);
  const ordered = !draft.from || !draft.to || (withTime ? draft.from < draft.to : draft.from <= draft.to);
  const withinLimit = !maxDays || !from || !to || (Date.parse(draft.to.slice(0,10)) - Date.parse(draft.from.slice(0,10))) / 86400000 + 1 <= maxDays;
  const label = current.from || current.to ? `${describe(current.from, withTime) || "Sin inicio"} — ${describe(current.to, withTime) || "Sin fin"}` : "Selecciona un período";
  function commit(next: RangeValue) { if (value === undefined) setLocal(next); onValueChange?.(next); setOpen(false); }
  function timePicker(bound: "from" | "to", label: string) {
    const time = draft[bound].slice(11,16) || "00:00";
    function change(hour: string, minute: string) { setDraft((previous) => ({ ...previous, [bound]: `${previous[bound].slice(0,10)}T${hour}:${minute}` })); }
    return <div className="min-w-0"><p className="mb-2 text-[11px] font-medium">{label}</p><div className="flex items-center gap-1.5"><Select items={hours} value={time.slice(0,2)} disabled={!draft[bound]} aria-label={`Hora de ${label.toLowerCase()}`} className="h-9 text-xs" onValueChange={(hour) => change(hour, time.slice(3,5))} /><span>:</span><Select items={minutes} value={time.slice(3,5)} disabled={!draft[bound]} aria-label={`Minuto de ${label.toLowerCase()}`} className="h-9 text-xs" onValueChange={(minute) => change(time.slice(0,2), minute)} /></div></div>;
  }
  return <><input type="hidden" name={fromName} value={current.from} disabled={disabled} /><input type="hidden" name={toName} value={current.to} disabled={disabled} />
    <Popover.Root open={open && !disabled} onOpenChange={(next) => { if (next) setDraft(current); setOpen(next); }}>
      <Popover.Trigger {...props} disabled={disabled} aria-required={required} className={cn("app-date-trigger flex h-10 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50", className)}><span title={label} className={cn("min-w-0 truncate", !current.from && !current.to && "text-muted-foreground")}>{label}</span><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Popover.Trigger>
      <Popover.Portal><Popover.Positioner className="app-date-positioner" align="start" sideOffset={8} positionMethod="fixed"><Popover.Popup className="app-date-popup" aria-label="Elegir período">
        <div className="border-b border-border px-4 py-3"><p className="text-xs font-semibold">Selecciona inicio y fin</p><p aria-live="polite" className="mt-1 text-[10px] leading-5 text-muted-foreground">{from && !to ? "Ahora elige la fecha final." : "Puedes navegar entre meses para completar el período."}</p></div>
        <Calendar mode="range" resetOnSelect selected={from || to ? { from, to } : undefined} defaultMonth={from ?? to} onSelect={(range) => setDraft((previous) => ({ from: range?.from ? `${format(range.from, "yyyy-MM-dd")}${withTime ? `T${previous.from.slice(11,16) || "00:00"}` : ""}` : "", to: range?.to ? `${format(range.to, "yyyy-MM-dd")}${withTime ? `T${previous.to.slice(11,16) || "00:00"}` : ""}` : "" }))} />
        {withTime ? <div className="border-t border-border px-4 py-3"><div className="grid grid-cols-2 gap-4">{timePicker("from", "Inicio")}{timePicker("to", "Fin")}</div><p className="mt-2 text-[10px] text-muted-foreground">Hora de Perú. La vigencia termina en la fecha y hora de fin.</p></div> : null}
        {!required ? <div className="flex flex-wrap gap-4 border-t border-border px-4 py-3 text-[11px]"><button type="button" onClick={() => setDraft((previous) => ({ ...previous, from: "" }))} className="text-muted-foreground underline">Sin inicio</button><button type="button" onClick={() => setDraft((previous) => ({ ...previous, to: "" }))} className="text-muted-foreground underline">Sin fin</button><button type="button" onClick={() => setDraft(empty)} className="text-muted-foreground underline">Quitar fechas</button></div> : null}
        {!ordered || !withinLimit ? <p role="alert" className="px-4 pb-3 text-[11px] text-destructive">{!ordered ? "El fin debe ser posterior al inicio." : `Selecciona hasta ${maxDays} días.`}</p> : null}
        <div className="flex justify-end gap-2 border-t border-border px-4 py-3"><Popover.Close className="rounded-lg border border-border px-3 py-2 text-xs">Cancelar</Popover.Close><button type="button" disabled={!validDates || !ordered || !withinLimit} onClick={() => commit(draft)} className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white disabled:opacity-40">Aplicar período</button></div>
      </Popover.Popup></Popover.Positioner></Popover.Portal>
    </Popover.Root>
  </>;
}
export function DateRangePicker(props: Props) {
  return <RangeControl key={props.value === undefined ? `${props.defaultValue?.from ?? ""}:${props.defaultValue?.to ?? ""}` : undefined} {...props} />;
}
