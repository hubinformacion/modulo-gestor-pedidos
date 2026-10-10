"use client";
import { SortableTable } from "@/components/sortable-table";

import { useState, useTransition, type FormEvent } from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
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
  const [confirm, setConfirm] = useState<BookRow | null>(null);
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
  function report(result: ActionResult) { setMessage(result.success ? null : result); if (result.success) sileo.success({ title: result.message }); else sileo.error({ title: "No se pudo guardar", description: result.message }); }
  function edit(row: BookRow) {
    setEditing({ id: row.id, version: row.version }); setForm({ inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status }); setErrors({}); setMessage(null); setConfirm(null);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !creating) return;
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
  const notification = message ? <p role="alert" className="text-xs leading-6 text-destructive">{message.message}</p> : null;
  const tableRows: BookRow[] = creating ? [{ ...emptyBook, id: "new-book", version: "" }, ...visible] : visible;
  const busy = Boolean(editing) || creating;

  return <div className="mt-7 space-y-5" data-order-editing={busy || pending ? "true" : undefined}>
    <div className="flex flex-wrap items-end gap-4"><div className="min-w-56 flex-1"><Field id="inventory-search" label="Buscar publicación" placeholder="Título, autor o código" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} disabled={busy || pending} /></div><div className="w-40"><SelectField id="inventory-imprint" label="Sello" value={imprint} onChange={(event) => setImprint(event.target.value)} disabled={busy || pending}><option value="">Ambos sellos</option><option value="universidad">Universidad</option><option value="instituto">Instituto</option></SelectField></div><div className="w-36"><SelectField id="inventory-status" label="Estado" value={status} onChange={(event) => setStatus(event.target.value)} disabled={busy || pending}><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField></div>
      <Button type="button" className="h-11 px-4" disabled={pending || busy} onClick={() => { reset(); setForm({ ...emptyBook, publisherImprint: imprint === "instituto" ? "instituto" : "universidad" }); setMessage(null); setCreating(true); }}><Plus aria-hidden="true" />Añadir publicación</Button>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{visible.length} de {rows.length} publicaciones</p><p>{busy ? "Guarda o cancela la fila antes de continuar." : "Edita una fila para actualizar sus datos."}</p></div>
    <form id="inventory-edit" onSubmit={submit} noValidate>
      <div className="overflow-x-auto rounded-xl border border-border"><SortableTable className="w-full min-w-[980px] text-left text-xs"><caption className="sr-only">Inventario de publicaciones con edición por fila</caption><thead className="border-b border-border bg-muted/40 text-muted-foreground"><tr>{["Código", "Publicación", "Sello", "Público (S/)", "Comunidad (S/)", "Stock", "Estado", "Acciones"].map((label) => <th key={label} scope="col" className="whitespace-nowrap px-4 py-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{tableRows.map((row) => {
        const active = editing?.id === row.id || (creating && row.id === "new-book");
        return <tr key={row.id} className={active ? "bg-secondary/25" : "hover:bg-muted/20"}>
          <td className="min-w-36 px-4 py-4 align-top" data-sort-value={row.inventoryCode}>{active ? inlineField("inventoryCode", "Código de inventario", "Ej. UC-001") : row.inventoryCode}</td>
          <td data-sort-value={row.title} className="min-w-64 max-w-80 px-4 py-4 align-top">{active ? <div className="space-y-2">{inlineField("title", "Título", "Título de la publicación")}{inlineField("author", "Autor", "Autor o autores")}</div> : <><p className="text-sm font-semibold leading-6">{row.title}</p><p className="mt-1 leading-5 text-muted-foreground">{row.author}</p></>}</td>
          <td className="w-40 px-4 py-4 align-top">{active ? <select aria-label="Sello editorial" className={selectClass} value={form.publisherImprint} onChange={(event) => set("publisherImprint", event.target.value as BookForm["publisherImprint"])} disabled={pending}><option value="universidad">Universidad</option><option value="instituto">Instituto</option></select> : <ImprintBadge imprint={row.publisherImprint} />}</td>
          <td className="w-32 px-4 py-4 align-top tabular-nums">{active ? inlineField("standardPrice", "Precio público en soles", "0.00") : formatMoney(toCents(row.standardPrice))}</td>
          <td className="w-32 px-4 py-4 align-top tabular-nums">{active ? inlineField("communityPrice", "Precio comunidad en soles", "0.00") : formatMoney(toCents(row.communityPrice))}</td>
          <td className="w-24 px-4 py-4 align-top">{active ? <><Input type="number" aria-label="Stock disponible" placeholder="0" min={0} max={2147483647} step={1} value={Number.isNaN(form.stock) ? "" : form.stock} onChange={(event) => set("stock", event.target.value === "" ? NaN : Number(event.target.value))} disabled={pending} aria-invalid={Boolean(errors.stock)} aria-describedby={errors.stock ? "edit-stock-error" : undefined} className="h-9 text-xs" />{errors.stock ? <p id="edit-stock-error" className="mt-1 text-[11px] text-destructive">{errors.stock}</p> : null}</> : <span className={`font-semibold tabular-nums ${row.stock === 0 ? "text-destructive" : "text-foreground"}`}>{row.stock}</span>}</td>
          <td className="w-32 px-4 py-4 align-top">{active ? <select aria-label="Estado de publicación" className={selectClass} value={form.status} onChange={(event) => set("status", event.target.value as BookForm["status"])} disabled={pending}><option value="INACTIVO">Inactivo</option><option value="ACTIVO">Activo</option></select> : <span className={`inline-flex rounded-md px-2 py-1 text-[11px] font-medium ${row.status === "ACTIVO" ? "bg-secondary text-primary" : "bg-muted text-muted-foreground"}`}>{row.status === "ACTIVO" ? "Activo" : "Inactivo"}</span>}</td>
          <td className="w-36 px-4 py-4 align-top">{active ? <div className="flex gap-1"><Button key="save" type="submit" size="icon" disabled={pending} aria-label={creating ? "Crear publicación" : `Guardar cambios de ${row.title}`} title={creating ? "Crear publicación" : "Guardar cambios"}><Check aria-hidden="true" /></Button><Button key="cancel" type="button" variant="outline" size="icon" disabled={pending} aria-label="Cancelar edición" title="Cancelar" onClick={() => { reset(); setCreating(false); setMessage(null); }}><X aria-hidden="true" /></Button></div> : <div className="flex gap-1"><Button key="edit" type="button" variant="ghost" size="icon" disabled={pending || busy} aria-label={`Editar ${row.title}`} title="Editar" onClick={(event) => { event.preventDefault(); edit(row); }}><Pencil aria-hidden="true" /></Button><Button key="delete" type="button" variant="ghost" size="icon" disabled={pending || busy} aria-label={`Eliminar ${row.title}`} title="Eliminar" onClick={(event) => { event.preventDefault(); setConfirm(row); setMessage(null); }}><Trash2 aria-hidden="true" /></Button></div>}</td>
        </tr>;
      })}</tbody></SortableTable>{!tableRows.length ? <div className="px-5 py-12 text-center"><p className="text-sm font-medium">No hay publicaciones para esta selección.</p><p className="mt-2 text-xs text-muted-foreground">Añade una publicación o ajusta los filtros.</p></div> : null}</div>
      {!confirm && notification ? <div className="mt-4">{notification}</div> : null}
    </form>
    <AlertDialog.Root open={Boolean(confirm)} onOpenChange={(open, details) => { if (pending) { details.cancel(); return; } if (!open) { setConfirm(null); setMessage(null); } }}>
      <AlertDialog.Portal><AlertDialog.Backdrop className="fixed inset-0 z-40 bg-black/30" /><AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white p-6 shadow-xl">
        <AlertDialog.Title className="text-base font-semibold">Eliminar publicación</AlertDialog.Title><AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">Se eliminará «{confirm?.title}». Esta acción no se puede deshacer.</AlertDialog.Description>
        {notification ? <div className="mt-3">{notification}</div> : null}
        <div className="mt-6 flex justify-end gap-2"><AlertDialog.Close render={<Button type="button" variant="outline" disabled={pending} className="h-10 px-4" />}>Cancelar</AlertDialog.Close><Button type="button" variant="destructive" disabled={pending} className="h-10 px-4" onClick={() => { if (confirm) remove(confirm); }}>{pending ? "Eliminando…" : "Eliminar"}</Button></div>
      </AlertDialog.Popup></AlertDialog.Portal>
    </AlertDialog.Root>
  </div>;
}
