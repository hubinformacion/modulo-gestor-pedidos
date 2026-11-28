"use client";
import { useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/form-fields";
import { formatMoney, toCents } from "@/modules/orders/domain/money";
import { notifyAction } from "@/components/feedback/notify-action";
import { deliveryRateSchema, deliveryZoneLabels, type DeliveryRateRow } from "@/modules/settings/domain/delivery-rates";
import { saveDeliveryRateAction, deleteDeliveryRateAction } from "@/app/admin/delivery-rate-actions";
const empty = { zone: "lima_callao" as DeliveryRateRow["zone"], price: "", status: "ACTIVO" as DeliveryRateRow["status"] };
export function DeliveryRatesSettings({ rows }: { rows: DeliveryRateRow[] }) {
  const initial = { ...empty, zone: rows.some((row) => row.zone === "lima_callao") ? "provincia" as const : "lima_callao" as const };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState<DeliveryRateRow | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const canAdd = rows.length < Object.keys(deliveryZoneLabels).length;
  function edit(row: DeliveryRateRow) {
    setEditing(row);
    setForm({ zone: row.zone, price: row.price, status: row.status });
    setRemoving(null);
    setError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
      formRef.current?.querySelector<HTMLInputElement>("#delivery-rate-price")?.focus({ preventScroll: true });
    });
  }

  function reset() { setEditing(null); setForm(initial); setError(""); }
  return <div className="mt-4 grid items-start gap-5 @min-[43rem]:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] sm:gap-6">
    <section aria-labelledby="delivery-rate-list" className="min-w-0 overflow-hidden rounded-xl border border-border"><h3 id="delivery-rate-list" className="border-b border-border bg-muted/60 px-4 py-3.5 text-sm font-semibold sm:px-5">Tarifas registradas</h3><ul className="divide-y divide-border">{rows.map((row) => <li key={row.zone} className="px-4 py-3.5 sm:px-5"><div className="flex items-start gap-2 sm:gap-3"><div className="min-w-0 flex-1"><h4 className="text-sm font-semibold">{deliveryZoneLabels[row.zone]}</h4><p className="mt-2 text-xl font-semibold tabular-nums">{formatMoney(toCents(row.price))}</p><p className="mt-2 text-xs text-muted-foreground">{row.status === "ACTIVO" ? "Disponible para nuevas compras" : "Delivery desactivado para esta zona"}</p></div><Button size="icon" variant="outline" disabled={pending} aria-label={`Editar tarifa de ${deliveryZoneLabels[row.zone]}`} onClick={() => edit(row)}><Pencil /></Button><Button size="icon" variant="ghost" disabled={pending} aria-label={`Eliminar tarifa de ${deliveryZoneLabels[row.zone]}`} onClick={() => setRemoving(row.zone)}><Trash2 /></Button></div>{removing === row.zone ? <div className="mt-4 rounded-lg border border-border p-3"><p className="text-xs leading-6">Al eliminarla, el delivery de esta zona dejará de estar disponible. Los pedidos anteriores conservan su costo.</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { try { const result = await notifyAction(() => deleteDeliveryRateAction({ zone: row.zone, version: row.version }), { loading: { title: "Eliminando tarifa", description: "Retiramos la zona de nuevas compras con delivery." }, success: { title: "Tarifa eliminada", description: "Los importes de pedidos existentes se conservaron." }, error: { title: "No se pudo eliminar", description: "Actualiza las tarifas y reintenta." } }); if (result.success) { setRemoving(null); if (editing?.zone === row.zone) reset(); } else setError(result.message); } catch { setError("No pudimos eliminar la tarifa."); } })}>Eliminar</Button><Button variant="outline" disabled={pending} onClick={() => setRemoving(null)}>Cancelar</Button></div></div> : null}</li>)}</ul>{!rows.length ? <p className="p-5 text-xs text-muted-foreground">No hay tarifas registradas. El recojo en biblioteca sigue siendo gratuito.</p> : null}<p className="border-t border-border bg-secondary/20 p-5 text-xs leading-6 text-muted-foreground">Recojo en campus: S/ 0.00. En pedidos mixtos, el delivery se abona únicamente en la cuenta de Universidad.</p></section>
    {editing || canAdd ? <form ref={formRef} className="min-w-0 scroll-mt-24 rounded-xl border border-border bg-muted/40 p-4 sm:p-5" noValidate onSubmit={(event) => { event.preventDefault(); const parsed = deliveryRateSchema.safeParse({ ...form, ...(editing ? { version: editing.version } : {}) }); if (!parsed.success) { setError(parsed.error.issues[0].message); return; } startTransition(async () => { try { const result = await notifyAction(() => saveDeliveryRateAction(parsed.data), { loading: { title: "Guardando tarifa", description: "Actualizamos el costo para nuevas compras." }, success: { title: "Tarifa guardada", description: "Los pedidos anteriores conservarán sus importes." }, error: { title: "No se pudo guardar", description: "Revisa el precio y actualiza la configuración." } }); if (result.success) reset(); else setError(result.message); } catch { setError("No pudimos guardar la tarifa."); } }); }}><h3 className="text-sm font-semibold">{editing ? "Editar tarifa" : "Añadir tarifa"}</h3><fieldset disabled={pending} className="mt-5 space-y-4"><SelectField id="delivery-rate-zone" label="Zona de entrega" value={form.zone} disabled={Boolean(editing)} onValueChange={(zone) => setForm({ ...form, zone: zone as DeliveryRateRow["zone"] })}>{Object.entries(deliveryZoneLabels).map(([value, label]) => <option key={value} value={value} disabled={!editing && rows.some((row) => row.zone === value)}>{label}</option>)}</SelectField><Field id="delivery-rate-price" label="Precio (S/)" placeholder="Ej. 15.00" inputMode="decimal" maxLength={9} value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} required /><SelectField id="delivery-rate-status" label="Estado" value={form.status} onValueChange={(status) => setForm({ ...form, status: status as DeliveryRateRow["status"] })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField></fieldset><div className="mt-5 flex gap-2"><Button type="submit" disabled={pending}><Plus />Guardar tarifa</Button>{editing ? <Button type="button" variant="outline" disabled={pending} onClick={reset}>Cancelar</Button> : null}</div>{error ? <p role="alert" className="mt-4 text-xs leading-6 text-destructive">{error}</p> : null}</form> : <aside className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
      <h3 className="text-sm font-semibold">Actualizar una tarifa</h3>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">Las dos zonas ya tienen tarifa. Selecciona el lápiz en la zona que quieres editar.</p>
      {error ? <p role="alert" className="mt-3 text-xs leading-5 text-destructive">{error}</p> : null}
    </aside>}
  </div>;
}
