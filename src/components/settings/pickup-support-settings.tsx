"use client";
import { useRef, useState, useTransition } from "react";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/form-fields";
import { notifyAction } from "@/components/feedback/notify-action";
import { supportSchema, type SupportRow } from "@/modules/settings/domain/pickup-support";
import { saveSupportAction, deleteSupportAction } from "@/app/admin/support-actions";
const empty = { name: "", email: "", status: "ACTIVO" as SupportRow["status"] };
export function PickupSupportSettings({ rows }: { rows: SupportRow[] }) {
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<SupportRow | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function edit(row: SupportRow) {
    setEditing(row);
    setForm({ name: row.name, email: row.email, status: row.status });
    setRemoving(null);
    setError("");
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
      formRef.current?.querySelector<HTMLInputElement>("#support-name")?.focus({ preventScroll: true });
    });
  }

  function cancel() { setEditing(null); setForm(empty); setError(""); }
  return <div className="mt-4 grid items-start gap-5 @min-[43rem]:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] sm:gap-6">
    <section aria-labelledby="pickup-support-list" className="min-w-0 overflow-hidden rounded-xl border border-border">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/60 px-4 py-3.5 sm:px-5">
        <h3 id="pickup-support-list" className="text-sm font-semibold">Personal registrado</h3>
        <span className="text-xs text-muted-foreground">{rows.length} {rows.length === 1 ? "persona" : "personas"}</span>
      </header>
      <ul className="divide-y divide-border">{rows.map((row) => <li key={row.id} className="px-4 py-3.5 sm:px-5"><div className="flex items-start gap-2 sm:gap-3"><UserRound className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{row.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{row.email}</p><span className="mt-2 inline-flex rounded-md bg-secondary px-2 py-1 text-xs font-medium text-primary">{row.status === "ACTIVO" ? "Activo" : "Inactivo"}</span></div><Button size="icon" variant="ghost" disabled={pending} aria-label={`Editar ${row.name}`} onClick={() => edit(row)}><Pencil /></Button><Button size="icon" variant="ghost" disabled={pending} aria-label={`Eliminar ${row.name}`} onClick={() => setRemoving(row.id)}><Trash2 /></Button></div>{removing === row.id ? <div className="mt-3 flex flex-wrap items-center gap-2"><p className="text-xs">¿Eliminar a {row.name}?</p><Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => { try { const result = await notifyAction(() => deleteSupportAction({ id: row.id, version: row.version }), { loading: { title: "Eliminando registro", description: "Comprobamos sus pedidos asociados." }, success: { title: "Registro eliminado", description: "La persona ya no aparecerá como apoyo para nuevos recojos." }, error: { title: "No se pudo eliminar", description: "Si tiene pedidos asociados, puedes desactivar el registro." } }); if (result.success) { setRemoving(null); if (editing?.id === row.id) cancel(); } else setError(result.message); } catch { setError("No se pudo eliminar. Reintenta."); } })}>Eliminar</Button><Button variant="outline" disabled={pending} onClick={() => setRemoving(null)}>Cancelar</Button></div> : null}</li>)}</ul>{!rows.length ? <p className="p-6 text-sm text-muted-foreground">Añade a quienes apoyarán con los recojos. No recibirán acceso al sistema.</p> : null}
    </section>
    <form ref={formRef} noValidate className="min-w-0 scroll-mt-24 rounded-xl border border-border bg-muted/40 p-4 sm:p-5" onSubmit={(event) => { event.preventDefault(); const parsed = supportSchema.safeParse({ ...form, ...(editing ? { id: editing.id, version: editing.version } : {}) }); if (!parsed.success) { setError(parsed.error.issues[0].message); return; } startTransition(async () => { try { const result = await notifyAction(() => saveSupportAction(parsed.data), { loading: { title: "Guardando personal de apoyo", description: "Actualizamos el listado disponible para recojos." }, success: { title: "Personal de apoyo guardado", description: "El registro está disponible según su estado. No se creó un acceso al sistema." }, error: { title: "No se pudo guardar", description: "Conserva los datos y revisa el correo ingresado." } }); if (result.success) cancel(); else setError(result.message); } catch { setError("No se pudo guardar. Reintenta."); } }); }}>
      <h3 className="text-sm font-semibold">{editing ? "Editar persona" : "Añadir persona de apoyo"}</h3><p className="mt-2 text-xs leading-6 text-muted-foreground">Puede apoyar en cualquier campus. Recibirá por correo los datos necesarios para el recojo.</p>
      <fieldset disabled={pending} className="mt-5 space-y-4"><Field id="support-name" label="Nombres completos" placeholder="Nombres y apellidos" maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /><Field id="support-email" label="Correo electrónico" placeholder="nombre@continental.edu.pe" type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><SelectField id="support-status" label="Estado" value={form.status} onValueChange={(status) => setForm({ ...form, status: status as SupportRow["status"] })}><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField></fieldset>
      <div className="mt-5 flex gap-2"><Button type="submit" disabled={pending}><Plus />Guardar</Button>{editing ? <Button type="button" variant="outline" disabled={pending} onClick={cancel}>Cancelar</Button> : null}</div>{error ? <p role="alert" className="mt-4 text-xs leading-6 text-destructive">{error}</p> : null}
    </form>
  </div>;
}
