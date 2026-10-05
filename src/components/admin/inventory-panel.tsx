"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { sileo } from "sileo";
import { saveBookAction, deleteBookAction } from "@/app/admin/operations";
import { bookSchema, deleteBookSchema, emptyBook, type ActionResult, type BookForm, type BookRow } from "@/lib/admin/validation";
import { formatMoney, toCents } from "@/lib/orders/money";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const selectClass = "h-9 w-full rounded-lg border border-input bg-white px-2 text-xs outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/20 disabled:opacity-50";

export function InventoryPanel({ rows }: { rows: BookRow[] }) {
  const [form, setForm] = useState<BookForm>(emptyBook);
  const [editing, setEditing] = useState<{ id: string; version: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState("");
  const [imprint, setImprint] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = rows.filter((row) => (!imprint || row.publisherImprint === imprint) && (!status || row.status === status) && `${row.title} ${row.author} ${row.inventoryCode}`.toLocaleLowerCase("es").includes(normalized));
  function set<K extends keyof BookForm>(key: K, value: BookForm[K]) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); setMessage(null); }
  function reset() { setEditing(null); setForm(emptyBook); setErrors({}); setConfirm(null); }
  function report(result: ActionResult) { setMessage(result); if (result.success) sileo.success({ title: result.message }); else sileo.error({ title: "No se pudo guardar", description: result.message }); }
  function edit(row: BookRow) {
    setEditing({ id: row.id, version: row.version }); setForm({ inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status }); setErrors({}); setMessage(null); setConfirm(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = bookSchema.safeParse(form);
    if (!parsed.success) { const next: Record<string, string> = {}; for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message; setErrors(next); setMessage({ success: false, message: parsed.error.issues[0]?.message ?? "Revisa los campos indicados." }); return; }
    setErrors({}); setMessage(null);
    startTransition(async () => { try { const result = await saveBookAction({ book: parsed.data, ...editing }); if (result.success) { reset(); setCreating(false); } report(result); } catch { report({ success: false, message: "No se pudo guardar. Actualiza la página e intenta nuevamente." }); } });
  }
  function remove(row: BookRow) {
    const parsed = deleteBookSchema.safeParse({ id: row.id, version: row.version });
    if (!parsed.success) { report({ success: false, message: "Actualiza la publicación antes de eliminarla." }); return; }
    startTransition(async () => { try { const result = await deleteBookAction(parsed.data); if (result.success) { setConfirm(null); if (editing?.id === row.id) reset(); } report(result); } catch { report({ success: false, message: "No se pudo eliminar. Actualiza la página." }); } });
  }
  function inlineField(key: "title" | "author" | "inventoryCode" | "standardPrice" | "communityPrice", label: string, placeholder: string) {
    return <div><Input autoFocus={key === "title"} aria-label={label} placeholder={placeholder} value={form[key]} onChange={(event) => set(key, event.target.value)} aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `edit-${key}-error` : undefined} disabled={pending} className="h-9 text-xs" maxLength={key === "title" ? 300 : key === "author" ? 200 : key === "inventoryCode" ? 80 : 13} inputMode={key.endsWith("Price") ? "decimal" : "text"} />{errors[key] ? <p id={`edit-${key}-error`} className="mt-1 text-[11px] text-destructive">{errors[key]}</p> : null}</div>;
  }
  const notification = message ? <p role={message.success ? "status" : "alert"} className={`text-xs leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null;

  return <div className="mt-7 space-y-5">
    <div className="flex flex-wrap items-end gap-4"><div className="min-w-56 flex-1"><Field id="inventory-search" label="Buscar publicación" placeholder="Título, autor o código" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} disabled={Boolean(editing) || pending} /></div><div className="w-40"><SelectField id="inventory-imprint" label="Sello" value={imprint} onChange={(event) => setImprint(event.target.value)} disabled={Boolean(editing) || pending}><option value="">Ambos sellos</option><option value="universidad">Universidad</option><option value="instituto">Instituto</option></SelectField></div><div className="w-36"><SelectField id="inventory-status" label="Estado" value={status} onChange={(event) => setStatus(event.target.value)} disabled={Boolean(editing) || pending}><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField></div>
      <Dialog.Root open={creating} onOpenChange={(open) => { if (pending) return; if (open) { reset(); setMessage(null); } setCreating(open); }} disablePointerDismissal>
        <Dialog.Trigger render={<Button className="h-11 px-4" disabled={pending || Boolean(editing)} />}><Plus aria-hidden="true" />Añadir publicación</Dialog.Trigger>
        <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30" /><Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-6 shadow-xl sm:p-7">
          <div className="flex items-start justify-between gap-4"><Dialog.Title className="text-lg font-semibold tracking-tight">Añadir publicación</Dialog.Title><Dialog.Close render={<Button variant="ghost" size="icon" disabled={pending} aria-label="Cerrar formulario" />}><X aria-hidden="true" /></Dialog.Close></div><Dialog.Description className="mt-2 text-xs leading-6 text-muted-foreground">Completa los datos de la publicación. Puedes activarla cuando esté lista para el catálogo.</Dialog.Description>
          <form onSubmit={submit} noValidate className="mt-5"><fieldset disabled={pending} className="space-y-4"><legend className="sr-only">Nueva publicación</legend>
            <Field id="book-title" label="Título" placeholder="Título de la publicación" value={form.title} onChange={(event) => set("title", event.target.value)} error={errors.title} maxLength={300} required />
            <Field id="book-author" label="Autor" placeholder="Nombre del autor o autores" value={form.author} onChange={(event) => set("author", event.target.value)} error={errors.author} maxLength={200} required />
            <div className="grid gap-4 sm:grid-cols-2"><Field id="book-code" label="Código de inventario" placeholder="Ej. UC-001" value={form.inventoryCode} onChange={(event) => set("inventoryCode", event.target.value)} error={errors.inventoryCode} maxLength={80} required /><SelectField id="book-imprint" label="Sello editorial" value={form.publisherImprint} onChange={(event) => set("publisherImprint", event.target.value as BookForm["publisherImprint"])}><option value="universidad">Universidad Continental</option><option value="instituto">Instituto Continental</option></SelectField></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field id="book-standard" label="Precio público (S/)" placeholder="0.00" inputMode="decimal" value={form.standardPrice} onChange={(event) => set("standardPrice", event.target.value)} error={errors.standardPrice} required /><Field id="book-community" label="Precio comunidad (S/)" placeholder="0.00" inputMode="decimal" value={form.communityPrice} onChange={(event) => set("communityPrice", event.target.value)} error={errors.communityPrice} required /></div>
            <div className="grid gap-4 sm:grid-cols-2"><Field id="book-stock" label="Stock disponible" placeholder="0" type="number" min={0} max={2147483647} step={1} value={Number.isNaN(form.stock) ? "" : form.stock} onChange={(event) => set("stock", event.target.value === "" ? NaN : Number(event.target.value))} error={errors.stock} required /><SelectField id="book-status" label="Estado" value={form.status} onChange={(event) => set("status", event.target.value as BookForm["status"])}><option value="INACTIVO">Inactivo</option><option value="ACTIVO">Activo</option></SelectField></div>
          </fieldset>{notification ? <div className="mt-4">{notification}</div> : null}<div className="mt-6 flex justify-end gap-2 border-t border-border pt-5"><Dialog.Close render={<Button variant="outline" disabled={pending} className="h-10 px-4" />}>Cancelar</Dialog.Close><Button type="submit" disabled={pending} className="h-10 px-4">{pending ? "Guardando…" : "Crear publicación"}</Button></div></form>
        </Dialog.Popup></Dialog.Portal>
      </Dialog.Root>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{visible.length} de {rows.length} publicaciones</p><p>{editing ? "Guarda o cancela la fila antes de continuar." : "Edita una fila para actualizar sus datos."}</p></div>
    <form id="inventory-edit" onSubmit={submit} noValidate>
      <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[980px] text-left text-xs"><caption className="sr-only">Inventario de publicaciones con edición por fila</caption><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr>{["Publicación", "Sello", "Público (S/)", "Comunidad (S/)", "Stock", "Estado", "Acciones"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{visible.map((row) => {
        const active = editing?.id === row.id;
        return <tr key={row.id} className={active ? "bg-secondary/25" : "hover:bg-muted/20"}>
          <td className="min-w-64 max-w-80 px-4 py-4 align-top">{active ? <div className="space-y-2">{inlineField("title", "Título", "Título de la publicación")}{inlineField("author", "Autor", "Autor o autores")}{inlineField("inventoryCode", "Código de inventario", "Ej. UC-001")}</div> : <><p className="text-sm font-semibold leading-6">{row.title}</p><p className="mt-1 leading-5 text-muted-foreground">{row.author}</p><p className="mt-2 text-[11px] text-muted-foreground">{row.inventoryCode}</p></>}</td>
          <td className="w-40 px-4 py-4 align-top">{active ? <select aria-label="Sello editorial" className={selectClass} value={form.publisherImprint} onChange={(event) => set("publisherImprint", event.target.value as BookForm["publisherImprint"])} disabled={pending}><option value="universidad">Universidad</option><option value="instituto">Instituto</option></select> : <ImprintBadge imprint={row.publisherImprint} />}</td>
          <td className="w-32 px-4 py-4 align-top tabular-nums">{active ? inlineField("standardPrice", "Precio público en soles", "0.00") : formatMoney(toCents(row.standardPrice))}</td>
          <td className="w-32 px-4 py-4 align-top tabular-nums">{active ? inlineField("communityPrice", "Precio comunidad en soles", "0.00") : formatMoney(toCents(row.communityPrice))}</td>
          <td className="w-24 px-4 py-4 align-top">{active ? <><Input type="number" aria-label="Stock disponible" placeholder="0" min={0} max={2147483647} step={1} value={Number.isNaN(form.stock) ? "" : form.stock} onChange={(event) => set("stock", event.target.value === "" ? NaN : Number(event.target.value))} disabled={pending} aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? "edit-stock-error" : undefined} className="h-9 text-xs" />{errors.stock ? <p id="edit-stock-error" className="mt-1 text-[11px] text-destructive">{errors.stock}</p> : null}</> : <span className={`font-semibold tabular-nums ${row.stock === 0 ? "text-destructive" : "text-foreground"}`}>{row.stock}</span>}</td>
          <td className="w-32 px-4 py-4 align-top">{active ? <select aria-label="Estado de publicación" className={selectClass} value={form.status} onChange={(event) => set("status", event.target.value as BookForm["status"])} disabled={pending}><option value="INACTIVO">Inactivo</option><option value="ACTIVO">Activo</option></select> : <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${row.status === "ACTIVO" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>{row.status === "ACTIVO" ? "Activo" : "Inactivo"}</span>}</td>
          <td className="w-36 px-4 py-4 align-top">{active ? <div className="flex gap-1"><Button type="submit" size="icon" disabled={pending} aria-label={`Guardar cambios de ${row.title}`}><Check aria-hidden="true" /></Button><Button variant="outline" size="icon" disabled={pending} aria-label="Cancelar edición" onClick={() => { reset(); setMessage(null); }}><X aria-hidden="true" /></Button></div> : confirm === row.id ? <div className="space-y-2"><p className="text-[11px] leading-5">¿Eliminar publicación?</p><div className="flex gap-1"><Button variant="destructive" size="sm" disabled={pending} onClick={() => remove(row)}>Eliminar</Button><Button variant="ghost" size="icon" disabled={pending} aria-label="Cancelar eliminación" onClick={() => setConfirm(null)}><X aria-hidden="true" /></Button></div></div> : <div className="flex gap-1"><Button variant="ghost" size="icon" disabled={pending || Boolean(editing)} aria-label={`Editar ${row.title}`} onClick={() => edit(row)}><Pencil aria-hidden="true" /></Button><Button variant="ghost" size="icon" disabled={pending || Boolean(editing)} aria-label={`Eliminar ${row.title}`} onClick={() => { setConfirm(row.id); setMessage(null); }}><Trash2 aria-hidden="true" /></Button></div>}</td>
        </tr>;
      })}</tbody></table>{!visible.length ? <div className="px-5 py-12 text-center"><p className="text-sm font-medium">No hay publicaciones para esta selección.</p><p className="mt-2 text-xs text-muted-foreground">Añade una publicación o ajusta los filtros.</p></div> : null}</div>
      {!creating && notification ? <div className="mt-4">{notification}</div> : null}
    </form>
  </div>;
}
