"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { createCampusAction, deleteCampusAction, updateCampusAction } from "@/app/admin/campus-actions";
import { campusSchema, emptyCampus, type CampusActionResult, type CampusAdminRow, type CampusForm } from "@/lib/campuses/validation";

export function CampusesPanel({ rows }: { rows: CampusAdminRow[] }) {
  const [form, setForm] = useState<CampusForm>(emptyCampus);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<CampusActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function set<K extends keyof CampusForm>(key: K, value: CampusForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" })); setMessage(null);
  }

  function report(result: CampusActionResult) {
    setMessage(result);
    if (result.fieldErrors) setErrors(result.fieldErrors);
    if (result.success) sileo.success({ title: result.message });
    else sileo.error({ title: "No se pudo actualizar el campus", description: result.message });
  }

  function cancel() { setEditingId(null); setForm(emptyCampus); setErrors({}); setMessage(null); }

  function edit(row: CampusAdminRow) {
    setEditingId(row.id); setForm({ name: row.name, libraryAddress: row.libraryAddress, latitude: row.latitude, longitude: row.longitude, googleMapsEmbedUrl: row.googleMapsEmbedUrl, status: row.status });
    setErrors({}); setMessage(null); setConfirmId(null);
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = campusSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      setMessage({ success: false, message: "Revisa los datos del campus." });
      return;
    }
    setErrors({}); setMessage(null);
    startTransition(async () => {
      try {
        const result = editingId ? await updateCampusAction({ ...parsed.data, id: editingId }) : await createCampusAction(parsed.data);
        if (result.success) { setEditingId(null); setForm(emptyCampus); }
        report(result);
      } catch { report({ success: false, message: "No se pudo guardar. Recarga la página e intenta nuevamente." }); }
    });
  }

  function remove(id: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await deleteCampusAction(id);
        if (result.success) {
          setConfirmId(null);
          if (editingId === id) { setEditingId(null); setForm(emptyCampus); setErrors({}); }
        }
        report(result);
      } catch { report({ success: false, message: "No se pudo eliminar. Recarga la página e intenta nuevamente." }); }
    });
  }

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4"><h3 className="text-sm font-semibold">Campus registrados</h3><span className="rounded-md bg-muted px-2.5 py-1 text-xs text-muted-foreground">{rows.length}</span></div>
        {rows.length ? <ul className="divide-y divide-border">
          {rows.map((row) => <li key={row.id} className="p-5">
            <div className="flex items-start gap-3">
              <MapPin className="mt-1 hidden size-4 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">{row.name}</h4><span className={`rounded-md px-2 py-1 text-[10px] font-medium ${row.status === "ACTIVO" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>{row.status === "ACTIVO" ? "Activo" : "Inactivo"}</span></div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{row.libraryAddress}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{row.googleMapsEmbedUrl ? "Mapa personalizado" : row.latitude && row.longitude ? "Mapa por coordenadas" : "Mapa por dirección"}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-9" disabled={pending} aria-label={`Editar campus ${row.name}`} onClick={() => edit(row)}><Pencil aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" className="size-9 text-muted-foreground hover:text-destructive" disabled={pending} aria-label={`Eliminar campus ${row.name}`} onClick={() => { setConfirmId(row.id); setMessage(null); }}><Trash2 aria-hidden="true" /></Button>
              </div>
            </div>
            {confirmId === row.id ? <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4" role="group" aria-label={`Confirmar eliminación de ${row.name}`}>
              <p className="text-sm leading-6">¿Eliminar este campus? Si tiene pedidos asociados, puedes desactivarlo para conservar su historial.</p>
              <div className="mt-3 flex gap-2"><Button variant="destructive" className="h-10 px-3" disabled={pending} onClick={() => remove(row.id)}>{pending ? "Eliminando…" : "Eliminar campus"}</Button><Button variant="outline" className="h-10 px-3" disabled={pending} onClick={() => setConfirmId(null)}>Cancelar</Button></div>
            </div> : null}
          </li>)}
        </ul> : <p className="px-5 py-10 text-center text-sm text-muted-foreground">Añade el primer campus y su biblioteca.</p>}
      </div>
      <div>
        <form ref={formRef} onSubmit={submit} noValidate className="scroll-mt-6 rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold">{editingId ? "Editar campus" : "Añadir campus"}</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">Los campus activos aparecen en el comprador y en el recojo.</p>
          <fieldset disabled={pending} className="mt-5 space-y-5">
            <legend className="sr-only">Datos del campus</legend>
            <Field id="campus-name" label="Nombre del campus" value={form.name} onChange={(event) => set("name", event.target.value)} error={errors.name} maxLength={120} required />
            <Field id="campus-address" label="Dirección de biblioteca" value={form.libraryAddress} onChange={(event) => set("libraryAddress", event.target.value)} error={errors.libraryAddress} maxLength={300} required />
            <SelectField id="campus-status" label="Estado" value={form.status} onChange={(event) => set("status", event.target.value as CampusForm["status"])} error={errors.status}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField>
            <div className="border-t border-border pt-5">
              <h4 className="text-xs font-semibold">Ubicación precisa (opcional)</h4>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Usa coordenadas o la URL src del mapa embebido de Google. La URL tiene prioridad.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <Field id="campus-latitude" label="Latitud" inputMode="decimal" value={form.latitude} onChange={(event) => set("latitude", event.target.value)} error={errors.latitude} placeholder="Grados decimales" maxLength={20} />
                <Field id="campus-longitude" label="Longitud" inputMode="decimal" value={form.longitude} onChange={(event) => set("longitude", event.target.value)} error={errors.longitude} placeholder="Grados decimales" maxLength={20} />
              </div>
              <div className="mt-4"><Field id="campus-map-url" label="URL del mapa embebido" type="url" value={form.googleMapsEmbedUrl} onChange={(event) => set("googleMapsEmbedUrl", event.target.value)} error={errors.googleMapsEmbedUrl} hint="Google Maps → Compartir → Insertar un mapa. Copia solo la URL src." maxLength={4000} /></div>
            </div>
          </fieldset>
          <div className="mt-6 flex flex-wrap gap-2"><Button type="submit" disabled={pending} className="h-11 flex-1 gap-2 px-4"><Plus aria-hidden="true" />{pending ? "Guardando…" : editingId ? "Guardar cambios" : "Crear campus"}</Button>{editingId ? <Button type="button" variant="outline" disabled={pending} className="h-11 px-3" onClick={cancel}>Cancelar</Button> : null}</div>
          {message ? <p role={message.success ? "status" : "alert"} className={`mt-4 text-sm leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}
        </form>
      </div>
    </div>
  );
}
