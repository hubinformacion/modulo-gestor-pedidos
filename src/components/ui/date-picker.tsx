"use client";
import { useState, type ComponentProps } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "./calendar";
import { Select } from "./select";
import { cn } from "@/lib/utils";
export type DatePickerProps = Pick<ComponentProps<"button">, "id" | "className" | "disabled" | "aria-label" | "aria-labelledby" | "aria-describedby" | "aria-invalid"> & {
  name?: string; required?: boolean; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void; withTime?: boolean; placeholder?: string;
};
const hours = Array.from({ length: 24 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }));
const minutes = Array.from({ length: 60 }, (_, i) => ({ value: String(i).padStart(2, "0"), label: String(i).padStart(2, "0") }));
function parseDay(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return undefined;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
function DatePickerControl({ value, defaultValue, onValueChange, withTime = false, required, name, disabled, className, placeholder = "Selecciona una fecha", ...props }: DatePickerProps) {
  const [local, setLocal] = useState(defaultValue ?? "");
  const [open, setOpen] = useState(false);
  const current = value ?? local;
  const date = parseDay(current);
  const time = current.slice(11,16) || "00:00";
  function update(next: string) { if (value === undefined) setLocal(next); onValueChange?.(next); }
  function choose(day: Date) { update(`${format(day, "yyyy-MM-dd")}${withTime ? `T${time}` : ""}`); if (!withTime) setOpen(false); }
  return <><input type="hidden" name={name} value={current} disabled={disabled} /><Popover.Root open={open && !disabled} onOpenChange={setOpen}>
    <Popover.Trigger {...props} disabled={disabled} aria-required={required} className={cn("app-date-trigger flex h-11 w-full items-center justify-between gap-3 rounded-lg border border-input bg-white px-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50", className)}><span className={cn("min-w-0 truncate", !date && "text-muted-foreground")}>{date ? `${format(date, "dd MMM yyyy", { locale: es })}${withTime ? ` · ${time}` : ""}` : placeholder}</span><CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /></Popover.Trigger>
    <Popover.Portal><Popover.Positioner className="app-date-positioner" align="start" sideOffset={8} positionMethod="fixed"><Popover.Popup className="app-date-popup" aria-label={withTime ? "Elegir fecha y hora de Perú" : "Elegir fecha"}><Calendar mode="single" required selected={date} defaultMonth={date} onSelect={choose} />
      {withTime ? <div className="border-t border-border px-4 py-3"><p className="mb-3 text-xs font-medium">Hora de Perú</p><div className="flex items-center gap-2"><Select items={hours} value={time.slice(0,2)} disabled={!date} aria-label="Hora" className="h-9 text-xs" onValueChange={(hour) => { if (date) update(`${format(date, "yyyy-MM-dd")}T${hour}:${time.slice(3,5)}`); }} /><span className="text-muted-foreground">:</span><Select items={minutes} value={time.slice(3,5)} disabled={!date} aria-label="Minutos" className="h-9 text-xs" onValueChange={(minute) => { if (date) update(`${format(date, "yyyy-MM-dd")}T${time.slice(0,2)}:${minute}`); }} /></div><p className="mt-3 text-[10px] leading-5 text-muted-foreground">La vigencia se guarda en horario de Perú.</p></div> : null}
      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">{!required ? <button type="button" className="text-xs text-muted-foreground underline" onClick={() => { update(""); setOpen(false); }}>Quitar fecha</button> : <span className="text-[10px] text-muted-foreground">Selecciona un día del calendario</span>}<Popover.Close className="rounded-lg bg-primary px-3 py-2 text-xs font-medium text-white">Listo</Popover.Close></div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root></>;
}
export function DatePicker(props: DatePickerProps) {
  return <DatePickerControl key={props.value === undefined ? props.defaultValue ?? "" : undefined} {...props} />;
}
