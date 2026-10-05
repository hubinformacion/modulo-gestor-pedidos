"use client";

import { useRef, useState, useTransition, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { sileo } from "sileo";
import { saveBookAction, deleteBookAction } from "@/app/admin/operations";
import { bookSchema, deleteBookSchema, emptyBook, type ActionResult, type BookForm, type BookRow } from "@/lib/admin/validation";
import { formatMoney, toCents } from "@/lib/orders/money";
import { Field, SelectField } from "@/components/order-wizard/fields";
import { ImprintBadge } from "@/components/order-wizard/imprint-badge";
import { Button } from "@/components/ui/button";

export function InventoryPanel({ rows }: { rows: BookRow[] }) {
  const [form, setForm] = useState<BookForm>(emptyBook);
  const [editing, setEditing] = useState<{ id: string; version: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<ActionResult | null>(null);
  const [query, setQuery] = useState("");
  const [imprint, setImprint] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const normalized = query.trim().toLocaleLowerCase("es");
  const visible = rows.filter((row) => (!imprint || row.publisherImprint === imprint) && (!status || row.status === status) && `${row.title} ${row.author} ${row.inventoryCode}`.toLocaleLowerCase("es").includes(normalized));
  function set<K extends keyof BookForm>(key: K, value: BookForm[K]) { setForm((current) => ({ ...current, [key]: value })); setErrors((current) => ({ ...current, [key]: "" })); setMessage(null); }
  function reset() { setEditing(null); setForm(emptyBook); setErrors({}); }
  function report(result: ActionResult) { setMessage(result); if (result.success) sileo.success({ title: result.message }); else sileo.error({ title: "No se pudo guardar", description: result.message }); }
  function edit(row: BookRow) {
    setEditing({ id: row.id, version: row.version }); setForm({ inventoryCode: row.inventoryCode, title: row.title, author: row.author, publisherImprint: row.publisherImprint, standardPrice: row.standardPrice, communityPrice: row.communityPrice, stock: row.stock, status: row.status }); setErrors({}); setMessage(null); setConfirm(null);
    requestAnimationFrame(() => { formRef.current?.scrollIntoView({ block: "start", behavior: "instant" }); formRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }); });
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = bookSchema.safeParse(form);
    if (!parsed.success) { const next: Record<string, string> = {}; for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message; setErrors(next); setMessage({ success: false, message: "Revisa los campos indicados." }); return; }
    setErrors({}); setMessage(null);
    startTransition(async () => { try { const result = await saveBookAction({ book: parsed.data, ...editing }); if (result.success) reset(); report(result); } catch { report({ success: false, message: "No se pudo guardar. Actualiza la página e intenta nuevamente." }); } });
  }
  function remove(row: BookRow) {
    const parsed = deleteBookSchema.safeParse({ id: row.id, version: row.version });
    if (!parsed.success) { report({ success: false, message: "Actualiza la publicación antes de eliminarla." }); return; }
    startTransition(async () => { try { const result = await deleteBookAction(parsed.data); if (result.success) { setConfirm(null); if (editing?.id === row.id) reset(); } report(result); } catch { report({ success: false, message: "No se pudo eliminar. Actualiza la página." }); } });
  }
  return <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
    <section className="min-w-0 rounded-xl border border-border">
      <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2"><div className="sm:col-span-2"><Field id="inventory-search" label="Buscar publicación" placeholder="Título, autor o código" value={query} onChange={(event) => setQuery(event.target.value)} maxLength={120} /></div><SelectField id="inventory-imprint" label="Sello" value={imprint} onChange={(event) => setImprint(event.target.value)}><option value="">Ambos sellos</option><option value="universidad">Universidad</option><option value="instituto">Instituto</option></SelectField><SelectField id="inventory-status" label="Estado" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos</option><option value="ACTIVO">Activo</option><option value="INACTIVO">Inactivo</option></SelectField><p className="text-xs text-muted-foreground sm:col-span-2">{visible.length} de {rows.length} publicaciones</p></div>
      {visible.length ? <ul className="divide-y divide-border">{visible.map((row) => <li key={row.id} className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap gap-2"><ImprintBadge imprint={row.publisherImprint} /><span className="rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">{row.status === "ACTIVO" ? "Activo" : "Inactivo"}</span></div><h2 className="mt-3 text-sm font-semibold leading-6">{row.title}</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">{row.author} · {row.inventoryCode}</p></div><div className="flex shrink-0 gap-1"><Button variant="ghost" size="icon" disabled={pending} aria-label={`Editar ${row.title}`} onClick={() => edit(row)}><Pencil /></Button><Button variant="ghost" size="icon" disabled={pending} aria-label={`Eliminar ${row.title}`} onClick={() => setConfirm(row.id)}><Trash2 /></Button></div></div><dl className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-muted/30 px-3 py-3 text-xs"><div><dt className="text-muted-foreground">Público</dt><dd className="mt-2 font-semibold tabular-nums">{formatMoney(toCents(row.standardPrice))}</dd></div><div><dt className="text-muted-foreground">Comunidad</dt><dd className="mt-2 font-semibold tabular-nums">{formatMoney(toCents(row.communityPrice))}</dd></div><div><dt className="text-muted-foreground">Stock</dt><dd className={`mt-2 font-semibold tabular-nums ${row.stock === 0 ? "text-destructive" : "text-primary"}`}>{row.stock} unidades</dd></div></dl>{confirm === row.id ? <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-4"><p className="text-xs leading-6">¿Eliminar esta publicación? Si tiene pedidos asociados, desactívala para conservar su historial.</p><div className="mt-3 flex gap-2"><Button variant="destructive" disabled={pending} onClick={() => remove(row)}>{pending ? "Eliminando…" : "Eliminar"}</Button><Button variant="outline" disabled={pending} onClick={() => setConfirm(null)}>Cancelar</Button></div></div> : null}</li>)}</ul> : <div className="px-5 py-12 text-center"><p className="text-sm font-medium">No hay publicaciones para esta selección.</p><p className="mt-2 text-xs text-muted-foreground">Añade una publicación o ajusta los filtros.</p></div>}
    </section>
    <form ref={formRef} onSubmit={submit} noValidate className="scroll-mt-6 rounded-xl border border-border p-5 lg:sticky lg:top-6"><h2 className="text-sm font-semibold">{editing ? "Editar publicación" : "Añadir publicación"}</h2><p className="mt-2 text-xs leading-6 text-muted-foreground">Las publicaciones activas con stock se muestran en el catálogo.</p><fieldset disabled={pending} className="mt-5 space-y-4"><legend className="sr-only">Datos de la publicación</legend>
      <Field id="book-code" label="Código de inventario" placeholder="Ej. UC-001" value={form.inventoryCode} onChange={(event) => set("inventoryCode", event.target.value)} error={errors.inventoryCode} maxLength={80} required />
      <Field id="book-title" label="Título" placeholder="Título de la publicación" value={form.title} onChange={(event) => set("title", event.target.value)} error={errors.title} maxLength={300} required />
      <Field id="book-author" label="Autor" placeholder="Nombre del autor o autores" value={form.author} onChange={(event) => set("author", event.target.value)} error={errors.author} maxLength={200} required />
      <SelectField id="book-imprint" label="Sello editorial" value={form.publisherImprint} onChange={(event) => set("publisherImprint", event.target.value as BookForm["publisherImprint"])}><option value="universidad">Universidad Continental</option><option value="instituto">Instituto Continental</option></SelectField>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2"><Field id="book-standard" label="Precio público (S/)" placeholder="0.00" inputMode="decimal" value={form.standardPrice} onChange={(event) => set("standardPrice", event.target.value)} error={errors.standardPrice} required /><Field id="book-community" label="Precio comunidad (S/)" placeholder="0.00" inputMode="decimal" value={form.communityPrice} onChange={(event) => set("communityPrice", event.target.value)} error={errors.communityPrice} required /></div>
      <Field id="book-stock" label="Stock disponible" placeholder="0" type="number" min={0} max={2147483647} step={1} value={Number.isNaN(form.stock) ? "" : form.stock} onChange={(event) => set("stock", event.target.value === "" ? NaN : Number(event.target.value))} error={errors.stock} hint="Unidades disponibles después de los pedidos registrados." required />
      <SelectField id="book-status" label="Estado" value={form.status} onChange={(event) => set("status", event.target.value as BookForm["status"])}><option value="INACTIVO">Inactivo</option><option value="ACTIVO">Activo</option></SelectField>
    </fieldset><div className="mt-6 flex flex-wrap gap-2"><Button type="submit" disabled={pending} className="h-11 flex-1"><Plus />{pending ? "Guardando…" : editing ? "Guardar cambios" : "Crear publicación"}</Button>{editing ? <Button type="button" variant="outline" disabled={pending} className="h-11" onClick={() => { reset(); setMessage(null); }}>Cancelar</Button> : null}</div>{message ? <p role={message.success ? "status" : "alert"} className={`mt-4 text-xs leading-6 ${message.success ? "text-primary" : "text-destructive"}`}>{message.message}</p> : null}</form>
  </div>;
}
